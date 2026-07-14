import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getVietnamDayBoundaries, getVietnamStartOfMonthUtc } from '@/lib/vn-time'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ""

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const startOfMonth = getVietnamStartOfMonthUtc()
  const { startOfToday } = getVietnamDayBoundaries()

  const [
    totalUsers,
    totalLinks,
    totalClicks,
    newUsersThisMonth,
    newLinksThisMonth,
    clicksToday,
    clicksThisMonth,
    revenueResult,
    recentPayments,
    recentUsers,
    planCounts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.link.count(),
    prisma.click.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.link.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.click.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.click.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { status: 'completed' },
      take: 8,
      orderBy: { paidAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, plan: true, createdAt: true },
    }),
    prisma.user.groupBy({
      by: ['plan'],
      _count: { id: true },
    }),
  ])

  return NextResponse.json({
    totalUsers,
    totalLinks,
    totalClicks,
    newUsersThisMonth,
    newLinksThisMonth,
    clicksToday,
    clicksThisMonth,
    totalRevenue: revenueResult._sum.amount ?? 0,
    recentPayments,
    recentUsers,
    planCounts,
  })
}
