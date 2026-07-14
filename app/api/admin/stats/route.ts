import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { getVietnamDayBoundaries, getVietnamStartOfMonthUtc } from '@/lib/vn-time'

export async function GET() {
  const access = await requireAdmin('overview.read')
  if (!access.ok) return access.response

  const startOfMonth = getVietnamStartOfMonthUtc()
  const { startOfToday, startOfTomorrow } = getVietnamDayBoundaries()
  const expiringAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers, activeUsers, suspendedUsers, paidUsers, expiringUsers,
    totalLinks, activeLinks, disabledLinks, totalClicks, clicksToday,
    newUsersThisMonth, newLinksThisMonth, revenueTotal, revenueMonth, revenueToday,
    pendingPayments, unresolvedPayments, verifiedDomains, failedJobs,
    recentUsers, recentPayments, planCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'deleted' } } }),
    prisma.user.count({ where: { status: 'active' } }),
    prisma.user.count({ where: { status: 'suspended' } }),
    prisma.user.count({ where: { status: 'active', plan: { not: 'free' } } }),
    prisma.user.count({ where: { status: 'active', planExpiresAt: { gte: new Date(), lte: expiringAt } } }),
    prisma.link.count(),
    prisma.link.count({ where: { isActive: true, disabledByAdmin: false, isArchived: false } }),
    prisma.link.count({ where: { disabledByAdmin: true } }),
    prisma.click.count(),
    prisma.click.count({ where: { createdAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.link.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'completed', paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'completed', paidAt: { gte: startOfToday, lt: startOfTomorrow } }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: 'pending' } }),
    prisma.paymentEvent.count({ where: { status: { in: ['unmatched', 'amount_mismatch', 'error'] } } }),
    prisma.domain.count({ where: { verified: true, disabledAt: null } }),
    prisma.fbDebugJob.count({ where: { status: 'failed' } }),
    prisma.user.findMany({ take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, plan: true, status: true, createdAt: true } }),
    prisma.payment.findMany({ where: { status: 'completed' }, take: 8, orderBy: { paidAt: 'desc' }, select: { id: true, amount: true, paidAt: true, user: { select: { id: true, name: true, email: true } } } }),
    prisma.user.groupBy({ by: ['plan'], where: { status: 'active' }, _count: { id: true } }),
  ])

  return NextResponse.json({
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, paid: paidUsers, expiring: expiringUsers, newThisMonth: newUsersThisMonth },
    links: { total: totalLinks, active: activeLinks, disabled: disabledLinks, newThisMonth: newLinksThisMonth },
    clicks: { total: totalClicks, today: clicksToday },
    revenue: { total: revenueTotal._sum.amount || 0, month: revenueMonth._sum.amount || 0, today: revenueToday._sum.amount || 0 },
    operations: { pendingPayments, unresolvedPayments, verifiedDomains, failedJobs },
    recentUsers,
    recentPayments,
    planCounts,
  })
}
