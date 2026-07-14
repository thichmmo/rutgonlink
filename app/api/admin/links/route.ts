import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const access = await requireAdmin('links.read')
  if (!access.ok) return access.response

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const search = req.nextUrl.searchParams.get('search')?.trim() || ''
  const status = req.nextUrl.searchParams.get('status') || ''

  const where = {
    ...(search
      ? {
          OR: [
            { shortCode: { contains: search } },
            { title: { contains: search } },
            { originalUrl: { contains: search } },
            { user: { email: { contains: search } } },
            { domain: { domain: { contains: search } } },
          ],
        }
      : {}),
    ...(status === 'active'
      ? { isActive: true, disabledByAdmin: false, isArchived: false }
      : status === 'disabled'
        ? { disabledByAdmin: true }
        : status === 'inactive'
          ? { isActive: false, disabledByAdmin: false }
          : status === 'archived'
            ? { isArchived: true }
            : {}),
  }

  const [links, total, disabledCount, activeCount] = await Promise.all([
    prisma.link.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shortCode: true,
        title: true,
        originalUrl: true,
        isActive: true,
        isArchived: true,
        disabledByAdmin: true,
        adminNote: true,
        moderatedAt: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, status: true } },
        domain: { select: { domain: true } },
        _count: { select: { clicks: true } },
      },
    }),
    prisma.link.count({ where }),
    prisma.link.count({ where: { disabledByAdmin: true } }),
    prisma.link.count({ where: { isActive: true, disabledByAdmin: false, isArchived: false } }),
  ])

  return NextResponse.json({
    links: links.map(({ _count, ...link }) => ({ ...link, clickCount: _count.clicks })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    summary: { active: activeCount, disabled: disabledCount },
    canWrite: hasAdminPermission(access.admin, 'links.write'),
  })
}
