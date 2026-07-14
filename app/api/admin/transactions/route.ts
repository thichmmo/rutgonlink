import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ""

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const tab = searchParams.get('tab') ?? 'payments' // 'payments' | 'subscriptions'
  const limit = 20

  if (tab === 'subscriptions') {
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.subscription.count(),
    ])
    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
  }

  // payments tab
  const [items, total, revenueResult] = await Promise.all([
    prisma.payment.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        subscription: { select: { plan: true, period: true } },
      },
    }),
    prisma.payment.count(),
    prisma.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
  ])

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    totalRevenue: revenueResult._sum.amount ?? 0,
  })
}
