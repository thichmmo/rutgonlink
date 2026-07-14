import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ADMIN_ROLES, hasAdminPermission, requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import { computePlanEndDate, type BillingPeriod } from '@/lib/billing'

const PLANS = ['free', 'pro', 'ultra', 'ultra_plus'] as const
const PERIODS = ['1m', '6m', '1y', 'lifetime'] as const

const actionSchema = z.object({
  action: z.enum([
    'suspend',
    'activate',
    'soft-delete',
    'restore',
    'revoke-sessions',
    'revoke-api-key',
    'update-plan',
    'set-admin-role',
  ]),
  reason: z.string().trim().min(3).max(500),
  plan: z.enum(PLANS).optional(),
  period: z.enum(PERIODS).optional(),
  adminRole: z.enum(ADMIN_ROLES).nullable().optional(),
})

const USER_SNAPSHOT_SELECT = {
  id: true,
  email: true,
  name: true,
  status: true,
  adminRole: true,
  plan: true,
  planExpiresAt: true,
  suspendedAt: true,
  suspensionReason: true,
  deletedAt: true,
  sessionsRevokedAt: true,
  apiKey: true,
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin('users.read')
  if (!access.ok) return access.response
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SNAPSHOT_SELECT,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      googleDriveEmail: true,
      _count: {
        select: {
          links: true,
          domains: true,
          notes: true,
          ownedWorkspaces: true,
          payments: true,
        },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const [links, domains, payments, subscriptions, workspaces, recentActivity] = await Promise.all([
    prisma.link.findMany({
      where: { userId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shortCode: true,
        title: true,
        originalUrl: true,
        isActive: true,
        disabledByAdmin: true,
        createdAt: true,
        _count: { select: { clicks: true } },
      },
    }),
    prisma.domain.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, domain: true, verified: true, disabledAt: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { userId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, amount: true, content: true, status: true, paidAt: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { userId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, plan: true, period: true, status: true, startDate: true, endDate: true },
    }),
    prisma.workspace.findMany({
      where: { ownerId: id },
      select: { id: true, name: true, slug: true, createdAt: true },
    }),
    prisma.requestLog.findMany({
      where: { userId: id },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true, method: true, path: true, ip: true, country: true, createdAt: true },
    }),
  ])

  const { apiKey, ...safeUser } = user
  return NextResponse.json({
    user: { ...safeUser, hasApiKey: Boolean(apiKey) },
    links,
    domains,
    payments,
    subscriptions,
    workspaces,
    recentActivity,
    currentAdmin: { role: access.admin.role, permissions: access.admin.permissions },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin('users.read')
  if (!access.ok) return access.response
  const { id } = await params

  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const before = await prisma.user.findUnique({ where: { id }, select: USER_SNAPSHOT_SELECT })
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { action, reason, plan, period, adminRole } = parsed.data

  if (action === 'update-plan' && !hasAdminPermission(access.admin, 'billing.write')) {
    return NextResponse.json({ error: 'Role hiện tại không có quyền thay đổi gói' }, { status: 403 })
  }
  if (
    action !== 'update-plan' &&
    action !== 'set-admin-role' &&
    !hasAdminPermission(access.admin, 'users.write')
  ) {
    return NextResponse.json({ error: 'Role hiện tại không có quyền thay đổi user' }, { status: 403 })
  }
  const envOwner = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const isProtectedOwner = before.email.toLowerCase() === envOwner
  const targetIsAdmin = isProtectedOwner || Boolean(before.adminRole)

  if (targetIsAdmin && access.admin.role !== 'owner') {
    return NextResponse.json({ error: 'Chỉ owner được thay đổi tài khoản admin khác' }, { status: 403 })
  }

  if (
    isProtectedOwner &&
    ['suspend', 'soft-delete', 'set-admin-role'].includes(action)
  ) {
    return NextResponse.json({ error: 'Không thể thay đổi owner cấu hình bởi ADMIN_EMAIL' }, { status: 400 })
  }
  if (id === access.admin.id && ['suspend', 'soft-delete', 'revoke-sessions'].includes(action)) {
    return NextResponse.json({ error: 'Không thể tự khóa hoặc thu hồi phiên của chính mình' }, { status: 400 })
  }

  if (action === 'set-admin-role' && !hasAdminPermission(access.admin, 'users.roles')) {
    return NextResponse.json({ error: 'Chỉ owner được phân quyền admin' }, { status: 403 })
  }

  const now = new Date()

  if (action === 'suspend') {
    await prisma.user.update({
      where: { id },
      data: {
        status: 'suspended',
        suspendedAt: now,
        suspensionReason: reason,
        sessionsRevokedAt: now,
      },
    })
  } else if (action === 'activate') {
    await prisma.user.update({
      where: { id },
      data: { status: 'active', suspendedAt: null, suspensionReason: null },
    })
  } else if (action === 'soft-delete') {
    await prisma.user.update({
      where: { id },
      data: {
        status: 'deleted',
        deletedAt: now,
        suspendedAt: now,
        suspensionReason: reason,
        sessionsRevokedAt: now,
        apiKey: null,
      },
    })
  } else if (action === 'restore') {
    await prisma.user.update({
      where: { id },
      data: {
        status: 'active',
        deletedAt: null,
        suspendedAt: null,
        suspensionReason: null,
      },
    })
  } else if (action === 'revoke-sessions') {
    await prisma.user.update({ where: { id }, data: { sessionsRevokedAt: now } })
  } else if (action === 'revoke-api-key') {
    await prisma.user.update({ where: { id }, data: { apiKey: null } })
  } else if (action === 'set-admin-role') {
    await prisma.user.update({ where: { id }, data: { adminRole: adminRole || null } })
  } else if (action === 'update-plan') {
    if (!plan) return NextResponse.json({ error: 'Thiếu plan' }, { status: 400 })

    if (plan === 'free') {
      await prisma.user.update({ where: { id }, data: { plan: 'free', planExpiresAt: null } })
    } else {
      if (!period) return NextResponse.json({ error: 'Thiếu chu kỳ' }, { status: 400 })
      const expiresAt = computePlanEndDate(period as BillingPeriod, before.planExpiresAt)
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { plan, planExpiresAt: expiresAt } }),
        prisma.subscription.create({
          data: {
            userId: id,
            plan,
            period,
            status: 'gifted',
            startDate: now,
            endDate: expiresAt,
          },
        }),
      ])
    }
  }

  const after = await prisma.user.findUnique({ where: { id }, select: USER_SNAPSHOT_SELECT })
  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: `user.${action}`,
    entityType: 'user',
    entityId: id,
    reason,
    before,
    after,
  })

  return NextResponse.json({ ok: true, user: after })
}
