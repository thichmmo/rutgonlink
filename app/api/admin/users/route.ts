import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const access = await requireAdmin('users.read')
  if (!access.ok) return access.response

  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const search = searchParams.get('search')?.trim() || ''
  const plan = searchParams.get('plan') || ''
  const status = searchParams.get('status') || ''
  const loginType = searchParams.get('loginType') || ''
  const parsedNumericId = /^\d+$/.test(search) ? Number(search) : null
  const numericSearchId = parsedNumericId && Number.isInteger(parsedNumericId) && parsedNumericId <= 2_147_483_647
    ? parsedNumericId
    : null

  const where = {
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
            { id: { contains: search } },
            ...(numericSearchId ? [{ numericId: numericSearchId }] : []),
          ],
        }
      : {}),
    ...(plan ? { plan } : {}),
    ...(status ? { status } : {}),
    ...(loginType === 'google'
      ? { AND: [{ OR: [{ password: null }, { password: '' }] }] }
      : loginType === 'password'
        ? { AND: [{ password: { not: null } }, { password: { not: '' } }] }
        : {}),
  }

  const [users, total, statusCounts, planCounts] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numericId: true,
        name: true,
        email: true,
        password: true,
        status: true,
        adminRole: true,
        plan: true,
        planExpiresAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { links: true, domains: true, payments: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.user.groupBy({ by: ['plan'], _count: { id: true } }),
  ])

  const userIds = users.map((user) => user.id)
  const links = userIds.length
    ? await prisma.link.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, _count: { select: { clicks: true } } },
      })
    : []

  const clickCountByUser = new Map<string, number>()
  for (const link of links) {
    clickCountByUser.set(
      link.userId,
      (clickCountByUser.get(link.userId) || 0) + link._count.clicks,
    )
  }

  return NextResponse.json({
    users: users.map(({ password, _count, ...user }) => ({
      ...user,
      loginType: password ? 'password' : 'google',
      linkCount: _count.links,
      domainCount: _count.domains,
      paymentCount: _count.payments,
      clickCount: clickCountByUser.get(user.id) || 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    summary: {
      statuses: Object.fromEntries(statusCounts.map((item) => [item.status, item._count.id])),
      plans: Object.fromEntries(planCounts.map((item) => [item.plan, item._count.id])),
    },
  })
}
