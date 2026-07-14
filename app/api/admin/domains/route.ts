import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const access = await requireAdmin('domains.read')
  if (!access.ok) return access.response

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const search = req.nextUrl.searchParams.get('search')?.trim() || ''
  const status = req.nextUrl.searchParams.get('status') || ''
  const where = {
    ...(search
      ? {
          OR: [
            { domain: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
    ...(status === 'verified'
      ? { verified: true, disabledAt: null }
      : status === 'disabled'
        ? { disabledAt: { not: null } }
        : status === 'pending'
          ? { verified: false, disabledAt: null }
          : {}),
  }

  const [domains, total, verified, disabled] = await Promise.all([
    prisma.domain.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        domain: true,
        verified: true,
        disabledAt: true,
        disabledReason: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, status: true } },
        _count: { select: { links: true } },
      },
    }),
    prisma.domain.count({ where }),
    prisma.domain.count({ where: { verified: true, disabledAt: null } }),
    prisma.domain.count({ where: { disabledAt: { not: null } } }),
  ])

  return NextResponse.json({
    domains: domains.map(({ _count, ...domain }) => ({ ...domain, linkCount: _count.links })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    summary: { verified, disabled },
    canWrite: hasAdminPermission(access.admin, 'domains.write'),
  })
}
