import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const paymentId = searchParams.get('paymentId')

  if (paymentId) {
    // Check specific payment status
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId: user.id },
      include: { subscription: true },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: payment.status,
      plan: payment.subscription?.plan,
      period: payment.subscription?.period,
      paidAt: payment.paidAt,
    })
  }

  // Return current user subscription info
  return NextResponse.json({
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    isActive: user.plan === 'free' || !user.planExpiresAt || user.planExpiresAt > new Date(),
  })
}
