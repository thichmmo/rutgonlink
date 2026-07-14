import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const access = await requireAdmin('billing.read')
  if (!access.ok) return access.response

  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const tab = req.nextUrl.searchParams.get('tab') || 'payments'
  const status = req.nextUrl.searchParams.get('status') || ''
  const search = req.nextUrl.searchParams.get('search')?.trim() || ''

  if (tab === 'subscriptions') {
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? { OR: [{ user: { email: { contains: search } } }, { plan: { contains: search } }] }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.subscription.count({ where }),
    ])
    return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), canWrite: hasAdminPermission(access.admin, 'billing.write') })
  }

  if (tab === 'events') {
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { externalId: { contains: search } },
              { content: { contains: search } },
              { payment: { user: { email: { contains: search } } } },
            ],
          }
        : {}),
    }
    const [items, total, unresolved] = await Promise.all([
      prisma.paymentEvent.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      }),
      prisma.paymentEvent.count({ where }),
      prisma.paymentEvent.count({ where: { status: { in: ['unmatched', 'amount_mismatch', 'error'] } } }),
    ])
    return NextResponse.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      unresolved,
      canWrite: hasAdminPermission(access.admin, 'billing.write'),
    })
  }

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { content: { contains: search } },
            { transactionID: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }
  const [items, total, revenue, pending] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        subscription: { select: { plan: true, period: true, status: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: 'pending' } }),
  ])

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totalRevenue: revenue._sum.amount || 0,
    pending,
    canWrite: hasAdminPermission(access.admin, 'billing.write'),
  })
}
