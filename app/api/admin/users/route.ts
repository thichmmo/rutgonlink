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
  const limit = 20
  const search = searchParams.get('search') ?? ''
  const plan = searchParams.get('plan') ?? ''

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ]
  }
  if (plan) {
    where.plan = plan
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        plan: true,
        planExpiresAt: true,
        createdAt: true,
        _count: { select: { links: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  // Fetch click counts per user (sum clicks across all their links)
  const userIds = users.map(u => u.id)
  const clickCounts = await prisma.click.groupBy({
    by: ['linkId'],
    where: {
      link: { userId: { in: userIds } },
    },
    _count: { id: true },
  })

  // Map linkId -> userId
  const links = await prisma.link.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true },
  })
  const linkToUser: Record<string, string> = {}
  for (const l of links) linkToUser[l.id] = l.userId

  const userClicks: Record<string, number> = {}
  for (const c of clickCounts) {
    const uid = linkToUser[c.linkId]
    if (uid) userClicks[uid] = (userClicks[uid] ?? 0) + c._count.id
  }

  const result = users.map(({ password, _count, ...u }) => ({
    ...u,
    loginType: password && password.length > 0 ? 'password' : 'google',
    linkCount: _count.links,
    clickCount: userClicks[u.id] ?? 0,
  }))

  return NextResponse.json({ users: result, total, page, pages: Math.ceil(total / limit) })
}
