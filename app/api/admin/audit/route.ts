import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 30

export async function GET(req: NextRequest) {
  const access = await requireAdmin('logs.read')
  if (!access.ok) return access.response

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const search = req.nextUrl.searchParams.get('search')?.trim() || ''
  const action = req.nextUrl.searchParams.get('action') || ''
  const entityType = req.nextUrl.searchParams.get('entityType') || ''
  const where = {
    ...(search
      ? {
          OR: [
            { adminEmail: { contains: search } },
            { action: { contains: search } },
            { entityId: { contains: search } },
            { reason: { contains: search } },
          ],
        }
      : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(entityType ? { entityType } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.adminAuditLog.count({ where }),
  ])

  return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
}
