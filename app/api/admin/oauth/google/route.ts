import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordAdminAudit } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/admin-auth'
import {
  clearStoredGoogleOAuthCredentials,
  getGoogleOAuthStatus,
  saveGoogleOAuthCredentials,
} from '@/lib/google-oauth-config'
import { buildSiteUrl } from '@/lib/site-config'

const saveSchema = z.object({
  clientId: z
    .string()
    .trim()
    .min(20)
    .max(500)
    .refine(
      (value) => value.endsWith('.apps.googleusercontent.com'),
      'Google Client ID không đúng định dạng',
    ),
  clientSecret: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3).max(500),
})

const clearSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

const responseData = (
  status: Awaited<ReturnType<typeof getGoogleOAuthStatus>>,
) => ({
  ...status,
  googleCallback: buildSiteUrl('/api/auth/callback/google'),
  driveCallback: buildSiteUrl('/api/drive/callback'),
})

export async function GET() {
  const access = await requireAdmin('system.read')
  if (!access.ok) return access.response
  return NextResponse.json({
    ...responseData(await getGoogleOAuthStatus()),
    canWrite: access.admin.role === 'owner',
  })
}

export async function PUT(req: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response
  if (access.admin.role !== 'owner') {
    return NextResponse.json(
      { error: 'Chỉ owner được thay đổi OAuth credentials' },
      { status: 403 },
    )
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 },
    )
  }

  const before = await getGoogleOAuthStatus()
  try {
    const after = await saveGoogleOAuthCredentials(parsed.data)
    await recordAdminAudit({
      admin: access.admin,
      request: req,
      action: 'system.google-oauth.update',
      entityType: 'system',
      entityId: 'google-oauth',
      reason: parsed.data.reason,
      before,
      after,
    })
    return NextResponse.json(responseData(after))
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message === 'Google Client Secret is required'
        ? error.message
        : 'Không thể lưu Google OAuth'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response
  if (access.admin.role !== 'owner') {
    return NextResponse.json(
      { error: 'Chỉ owner được thay đổi OAuth credentials' },
      { status: 403 },
    )
  }

  const parsed = clearSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 },
    )
  }

  const before = await getGoogleOAuthStatus()
  const after = await clearStoredGoogleOAuthCredentials()
  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'system.google-oauth.clear-override',
    entityType: 'system',
    entityId: 'google-oauth',
    reason: parsed.data.reason,
    before,
    after,
  })
  return NextResponse.json(responseData(after))
}
