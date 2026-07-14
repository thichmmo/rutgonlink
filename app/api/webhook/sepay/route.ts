import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTransferContent } from '@/lib/plan-limits'
import { paymentEmitter } from '@/lib/payment-emitter'

type Period = '1m' | '6m' | '1y' | 'lifetime'

/** Compute end date from period, stacking on top of currentExpiresAt if still active. */
function computeEndDate(period: Period, currentExpiresAt: Date | null | undefined): Date | null {
  if (period === 'lifetime') return null
  const months = period === '1m' ? 1 : period === '6m' ? 6 : 12
  const now = new Date()
  // Stack from current expiry if it's still in the future
  const base = currentExpiresAt && currentExpiresAt > now ? new Date(currentExpiresAt) : now
  const end = new Date(base)
  end.setMonth(end.getMonth() + months)
  return end
}

/**
 * POST /api/webhook/sepay
 *
 * SePay sends this webhook after each bank transaction.
 *
 * Expected body:
 * {
 *   "id": 92704,
 *   "gateway": "MBBANK",
 *   "transactionDate": "2024-01-01 14:02:37",
 *   "accountNumber": "197919",
 *   "content": "LS12ABCD34 thanh toan goi pro",
 *   "transferType": "in",
 *   "transferAmount": 29000,
 *   "referenceCode": "MBVCB.xxx"
 * }
 *
 * Must respond HTTP 200 + { "success": true }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const {
    id,
    transferType,
    transferAmount,
    content,
    transactionDate,
    referenceCode,
  } = body

  const txId = String(id ?? '')
  const txAmount = Number(transferAmount ?? 0)
  const txType = String(transferType ?? '').toUpperCase()
  const txContent = String(content ?? '')

  console.log(`[SePay] TX id=${txId} type=${txType} amount=${txAmount} content="${txContent}"`)

  // Only process incoming transfers
  if (txType !== 'IN') {
    return NextResponse.json({ success: true, message: 'Ignored outgoing transfer' })
  }

  // Idempotent check: skip if already processed
  if (txId) {
    const existingByTx = await prisma.payment.findUnique({ where: { transactionID: txId } })
    if (existingByTx?.status === 'completed') {
      console.log(`[SePay] TX ${txId} already processed`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }
  }

  // Normalize content for matching
  const normalizedContent = normalizeTransferContent(txContent)

  // Find pending payment whose content appears in the bank transfer description
  const pendingPayments = await prisma.payment.findMany({
    where: { status: 'pending' },
    include: { subscription: true, user: true },
    orderBy: { createdAt: 'asc' },
  })

  const matchedPayment = pendingPayments.find((p) => {
    const normalizedCode = normalizeTransferContent(p.content)
    return normalizedContent.includes(normalizedCode)
  })

  if (!matchedPayment) {
    console.log(`[SePay] No matching pending payment for content: "${txContent}"`)
    // Still save for audit if we have a txId
    return NextResponse.json({ success: true, message: 'No matching payment found' })
  }

  // Verify amount matches
  if (txAmount < matchedPayment.amount) {
    console.warn(`[SePay] Amount mismatch: received ${txAmount}, expected ${matchedPayment.amount} for payment ${matchedPayment.id}`)
    return NextResponse.json({ success: true, message: 'Amount mismatch — not activated' })
  }

  const subscription = matchedPayment.subscription
  if (!subscription) {
    console.error(`[SePay] Payment ${matchedPayment.id} has no subscription`)
    return NextResponse.json({ success: true, message: 'Missing subscription' })
  }

  const period = subscription.period as Period
  const endDate = computeEndDate(period, matchedPayment.user.planExpiresAt as Date | null)
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: matchedPayment.id },
        data: {
          status: 'completed',
          transactionID: txId || null,
          paidAt: transactionDate ? new Date(String(transactionDate)) : now,
        },
      })

      // Update subscription
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          startDate: now,
          endDate: endDate,
        },
      })

      // Update user plan
      await tx.user.update({
        where: { id: matchedPayment.userId },
        data: {
          plan: subscription.plan,
          planExpiresAt: endDate,
        },
      })
    })

    console.log(
      `[SePay] Activated plan="${subscription.plan}" period="${period}" for user=${matchedPayment.userId}` +
      (endDate ? ` expires=${endDate.toISOString()}` : ' (lifetime)')
    )

    // Notify SSE clients immediately
    paymentEmitter.emit('payment:completed', matchedPayment.id)

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed and plan activated',
      referenceCode: referenceCode ?? null,
    })
  } catch (err) {
    console.error('[SePay] DB error during activation:', err)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
