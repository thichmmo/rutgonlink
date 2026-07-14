import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import { buildSiteUrl, getSiteHostname } from '@/lib/site-config'

const cleanupSchema = z.object({
  action: z.literal('cleanup-logs'),
  retentionDays: z.number().int().min(7).max(365),
  reason: z.string().trim().min(3).max(500),
})

export async function GET() {
  const access = await requireAdmin('system.read')
  if (!access.ok) return access.response

  const startedAt = Date.now()
  let database = { ok: true, latencyMs: 0, message: 'connected' }
  try {
    await prisma.user.count({ take: 1 })
    database.latencyMs = Date.now() - startedAt
  } catch (error) {
    database = { ok: false, latencyMs: Date.now() - startedAt, message: String(error) }
  }

  const [lastCron, lastWebhook, failedJobs, pendingJobs, unresolvedPayments, recentErrors] = await Promise.all([
    prisma.systemEvent.findFirst({ where: { type: 'cron' }, orderBy: { createdAt: 'desc' } }),
    prisma.systemEvent.findFirst({ where: { type: 'payment_webhook' }, orderBy: { createdAt: 'desc' } }),
    prisma.fbDebugJob.count({ where: { status: 'failed' } }),
    prisma.fbDebugJob.count({ where: { status: { in: ['pending', 'running'] } } }),
    prisma.paymentEvent.count({ where: { status: { in: ['unmatched', 'amount_mismatch', 'error'] } } }),
    prisma.systemEvent.findMany({
      where: { status: { in: ['warning', 'error'] } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    database,
    app: {
      hostname: getSiteHostname(),
      nodeEnv: process.env.NODE_ENV || 'development',
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      googleCallback: buildSiteUrl('/api/auth/callback/google'),
      driveCallback: buildSiteUrl('/api/drive/callback'),
      cronSecret: Boolean(process.env.CRON_SECRET),
      logSecret: Boolean(process.env.LOG_SECRET),
      encryptionKey: Boolean(process.env.ENCRYPTION_KEY),
      sepayWebhookSecret: Boolean(process.env.SEPAY_WEBHOOK_SECRET),
      facebookToken: Boolean(process.env.FACEBOOK_APP_TOKEN),
    },
    jobs: { failed: failedJobs, pending: pendingJobs },
    payments: { unresolved: unresolvedPayments },
    lastCron,
    lastWebhook,
    recentErrors,
    currentAdmin: { email: access.admin.email, role: access.admin.role },
  })
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response
  const parsed = cleanupSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const cutoff = new Date(Date.now() - parsed.data.retentionDays * 24 * 60 * 60 * 1000)
  const [requestLogs, systemEvents] = await prisma.$transaction([
    prisma.requestLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.systemEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ])

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'system.cleanup-logs',
    entityType: 'system',
    reason: parsed.data.reason,
    after: {
      retentionDays: parsed.data.retentionDays,
      requestLogsDeleted: requestLogs.count,
      systemEventsDeleted: systemEvents.count,
    },
  })

  return NextResponse.json({ ok: true, requestLogsDeleted: requestLogs.count, systemEventsDeleted: systemEvents.count })
}
