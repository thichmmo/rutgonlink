import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import { activatePayment } from '@/lib/billing'

const schema = z.object({
  action: z.enum(['complete', 'cancel']),
  reason: z.string().trim().min(3).max(500),
  transactionId: z.string().trim().max(191).optional(),
})

const snapshotSelect = {
  id: true,
  userId: true,
  subscriptionId: true,
  transactionID: true,
  amount: true,
  content: true,
  status: true,
  paidAt: true,
} as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin('billing.write')
  if (!access.ok) return access.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }
  const { id } = await params
  const before = await prisma.payment.findUnique({ where: { id }, select: snapshotSelect })
  if (!before) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  if (parsed.data.action === 'cancel') {
    if (before.status === 'completed') {
      return NextResponse.json({ error: 'Không thể hủy giao dịch đã hoàn tất' }, { status: 400 })
    }
    await prisma.payment.update({ where: { id }, data: { status: 'cancelled' } })
    if (before.subscriptionId) {
      await prisma.subscription.update({
        where: { id: before.subscriptionId },
        data: { status: 'cancelled' },
      })
    }
  } else {
    await prisma.$transaction(async (tx) => {
      await activatePayment(tx, {
        paymentId: id,
        transactionId: parsed.data.transactionId || `manual:${id}`,
      })
    })
  }

  const after = await prisma.payment.findUnique({ where: { id }, select: snapshotSelect })
  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: `payment.${parsed.data.action}`,
    entityType: 'payment',
    entityId: id,
    reason: parsed.data.reason,
    before,
    after,
  })

  return NextResponse.json({ ok: true, payment: after })
}
