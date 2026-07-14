import { prisma } from '@/lib/prisma'
import type { AdminContext } from '@/lib/admin-auth'

const SENSITIVE_KEY = /password|secret|token|apiKey|refreshToken/i

function serializeAuditData(value: unknown): string | null {
  if (value === undefined || value === null) return null

  return JSON.stringify(value, (key, currentValue) => {
    if (SENSITIVE_KEY.test(key)) return '[redacted]'
    if (currentValue instanceof Date) return currentValue.toISOString()
    return currentValue
  })
}

function getRequestMetadata(request?: Request) {
  if (!request) return { ip: null, userAgent: null }

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null

  return {
    ip,
    userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
  }
}

export async function recordAdminAudit(input: {
  admin: AdminContext
  request?: Request
  action: string
  entityType: string
  entityId?: string | null
  reason?: string | null
  before?: unknown
  after?: unknown
}) {
  const { ip, userAgent } = getRequestMetadata(input.request)

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.admin.id,
      adminEmail: input.admin.email,
      adminRole: input.admin.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      reason: input.reason?.trim() || null,
      beforeData: serializeAuditData(input.before),
      afterData: serializeAuditData(input.after),
      ip,
      userAgent,
    },
  })
}
