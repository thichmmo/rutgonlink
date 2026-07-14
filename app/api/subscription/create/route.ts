import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { customAlphabet } from 'nanoid'
import {
  MONTHLY_PRICE,
  PERIOD_BILLING_MONTHS,
  type Period,
} from '@/lib/plan-limits'

// Generate 6-letter unique suffix for payment content
const nanoidCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

type PaidPlan = 'pro' | 'ultra' | 'ultra_plus'

const PLAN_LABEL: Record<PaidPlan, string> = {
  pro: 'PRO',
  ultra: 'ULTRA',
  ultra_plus: 'ULTRAPLUS',
}
const schema = z.object({
  plan: z.enum(['pro', 'ultra', 'ultra_plus']),
  period: z.enum(['1m', '6m', '1y', 'lifetime']),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { plan, period } = schema.parse(body) as { plan: PaidPlan; period: Period }

    const amount = MONTHLY_PRICE[plan] * PERIOD_BILLING_MONTHS[period]

    // Generate unique content: "RUTGON VMETA [PLAN] [6-LETTER CODE]"
    let content = `RUTGON VMETA ${PLAN_LABEL[plan]} ${nanoidCode()}`
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.payment.findUnique({ where: { content } })
      if (!existing) break
      content = `RUTGON VMETA ${PLAN_LABEL[plan]} ${nanoidCode()}`
      attempts++
    }

    // Create subscription (pending) + payment record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          plan,
          period,
          status: 'pending',
        },
      })

      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          subscriptionId: subscription.id,
          amount,
          content,
          status: 'pending',
        },
      })

      return { subscription, payment }
    })

    return NextResponse.json({
      paymentId: result.payment.id,
      content: result.payment.content,
      amount: result.payment.amount,
      plan,
      period,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('POST /api/subscription/create error:', error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
