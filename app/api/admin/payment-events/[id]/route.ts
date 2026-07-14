import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import { activatePayment } from '@/lib/billing'

const schema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
})

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
  const event = await prisma.paymentEvent.findUnique({ where: { id } })
  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId } })
  if (!event || !payment) {
    return NextResponse.json({ error: 'Payment event hoặc payment không tồn tại' }, { status: 404 })
  }
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: `Payment đang ở trạng thái ${payment.status}` }, { status: 400 })
  }
  if (event.transferAmount < payment.amount) {
    return NextResponse.json({ error: 'Số tiền nhận nhỏ hơn số tiền payment yêu cầu' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await activatePayment(tx, {
      paymentId: payment.id,
      transactionId: event.externalId || `event:${event.id}`,
      paidAt: event.createdAt,
    })
    await tx.paymentEvent.update({
      where: { id: event.id },
      data: {
        paymentId: payment.id,
        status: 'manually_matched',
        message: parsed.data.reason,
        processedAt: new Date(),
      },
    })
  })

  const after = await prisma.paymentEvent.findUnique({ where: { id } })
  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'payment_event.match',
    entityType: 'payment_event',
    entityId: id,
    reason: parsed.data.reason,
    before: event,
    after,
  })

  return NextResponse.json({ ok: true, event: after })
}
