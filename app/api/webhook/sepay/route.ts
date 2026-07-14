import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTransferContent } from '@/lib/plan-limits'
import { paymentEmitter } from '@/lib/payment-emitter'
import { activatePayment } from '@/lib/billing'
import { recordSystemEvent } from '@/lib/system-events'
import { timingSafeEqual } from 'node:crypto'

function isValidWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.SEPAY_WEBHOOK_SECRET
  if (!expected) return false
  const authorization = req.headers.get('authorization') || ''
  const provided = req.headers.get('x-sepay-secret') ||
    (authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7) : '')
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
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
  if (!process.env.SEPAY_WEBHOOK_SECRET) {
    console.error('[SePay] err webhook secret missing')
    return NextResponse.json({ success: false, message: 'Webhook not configured' }, { status: 500 })
  }
  if (!isValidWebhookSecret(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

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
  const eventPayload = JSON.stringify({
    id,
    gateway: body.gateway,
    transactionDate,
    transferType,
    transferAmount,
    content,
    referenceCode,
  })

  const paymentEvent = txId
    ? await prisma.paymentEvent.upsert({
        where: { externalId: txId },
        create: {
          externalId: txId,
          transferAmount: txAmount,
          content: txContent,
          payload: eventPayload,
        },
        update: { transferAmount: txAmount, content: txContent, payload: eventPayload },
      })
    : await prisma.paymentEvent.create({
        data: { transferAmount: txAmount, content: txContent, payload: eventPayload },
      })

  console.log(`[SePay] TX id=${txId} type=${txType} amount=${txAmount} content="${txContent}"`)

  // Only process incoming transfers
  if (txType !== 'IN') {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: 'ignored', message: 'Outgoing transfer', processedAt: new Date() },
    })
    return NextResponse.json({ success: true, message: 'Ignored outgoing transfer' })
  }

  // Idempotent check: skip if already processed
  if (txId) {
    const existingByTx = await prisma.payment.findUnique({ where: { transactionID: txId } })
    if (existingByTx?.status === 'completed') {
      console.log(`[SePay] TX ${txId} already processed`)
      await prisma.paymentEvent.update({
        where: { id: paymentEvent.id },
        data: {
          paymentId: existingByTx.id,
          status: 'duplicate',
          message: 'Payment already completed',
          processedAt: new Date(),
        },
      })
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
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { status: 'unmatched', message: 'No matching pending payment' },
    })
    await recordSystemEvent({
      type: 'payment_webhook',
      source: 'sepay',
      status: 'warning',
      message: 'Unmatched bank transfer',
      details: { paymentEventId: paymentEvent.id, amount: txAmount },
    })
    return NextResponse.json({ success: true, message: 'No matching payment found' })
  }

  // Verify amount matches
  if (txAmount < matchedPayment.amount) {
    console.warn(`[SePay] Amount mismatch: received ${txAmount}, expected ${matchedPayment.amount} for payment ${matchedPayment.id}`)
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: {
        paymentId: matchedPayment.id,
        status: 'amount_mismatch',
        message: `Received ${txAmount}, expected ${matchedPayment.amount}`,
      },
    })
    return NextResponse.json({ success: true, message: 'Amount mismatch — not activated' })
  }

  const subscription = matchedPayment.subscription
  if (!subscription) {
    console.error(`[SePay] Payment ${matchedPayment.id} has no subscription`)
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: {
        paymentId: matchedPayment.id,
        status: 'error',
        message: 'Payment has no subscription',
        processedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, message: 'Missing subscription' })
  }

  const now = new Date()

    try {
      await prisma.$transaction(async (tx) => {
        await activatePayment(tx, {
          paymentId: matchedPayment.id,
          transactionId: txId || null,
          paidAt: transactionDate ? new Date(String(transactionDate)) : now,
        })
        await tx.paymentEvent.update({
          where: { id: paymentEvent.id },
          data: {
            paymentId: matchedPayment.id,
            status: 'matched',
            message: 'Payment confirmed and plan activated',
            processedAt: now,
          },
        })
      })

      console.log(
        `[SePay] Activated plan="${subscription.plan}" period="${subscription.period}" for user=${matchedPayment.userId}`
      )

      await recordSystemEvent({
        type: 'payment_webhook',
        source: 'sepay',
        status: 'ok',
        message: 'Payment confirmed and plan activated',
        details: { paymentId: matchedPayment.id, paymentEventId: paymentEvent.id },
      })

    // Notify SSE clients immediately
    paymentEmitter.emit('payment:completed', matchedPayment.id)

    return NextResponse.json({
      success: true,
      message: 'Payment confirmed and plan activated',
      referenceCode: referenceCode ?? null,
    })
    } catch (err) {
      console.error('[SePay] DB error during activation:', err)
      await prisma.paymentEvent.update({
        where: { id: paymentEvent.id },
        data: { status: 'error', message: String(err), processedAt: new Date() },
      })
      return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
