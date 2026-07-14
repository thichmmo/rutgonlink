import type { Prisma } from '@prisma/client'

export type BillingPeriod = '1m' | '6m' | '1y' | 'lifetime'
const BILLING_PERIODS = new Set<BillingPeriod>(['1m', '6m', '1y', 'lifetime'])

export function computePlanEndDate(
  period: BillingPeriod,
  currentExpiresAt: Date | null | undefined,
): Date | null {
  if (period === 'lifetime') return null

  const months = period === '1m' ? 1 : period === '6m' ? 6 : 12
  const now = new Date()
  const base = currentExpiresAt && currentExpiresAt > now ? new Date(currentExpiresAt) : now
  const endDate = new Date(base)
  endDate.setMonth(endDate.getMonth() + months)
  return endDate
}

export async function activatePayment(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string
    transactionId?: string | null
    paidAt?: Date
  },
) {
  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    include: { subscription: true, user: true },
  })
    if (!payment) throw new Error('Payment not found')
    if (!payment.subscription) throw new Error('Payment has no subscription')

    if (payment.status === 'completed') return payment
    if (payment.status !== 'pending') throw new Error(`Payment is ${payment.status}`)

    const period = payment.subscription.period as BillingPeriod
    if (!BILLING_PERIODS.has(period)) throw new Error('Invalid billing period')
  const paidAt = input.paidAt || new Date()
  const endDate = computePlanEndDate(period, payment.user.planExpiresAt)

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'completed',
      transactionID: input.transactionId || payment.transactionID,
      paidAt,
    },
  })

  await tx.subscription.update({
    where: { id: payment.subscription.id },
    data: { status: 'active', startDate: paidAt, endDate },
  })

  await tx.user.update({
    where: { id: payment.userId },
    data: { plan: payment.subscription.plan, planExpiresAt: endDate },
  })

  return { ...payment, paidAt, endDate }
}
