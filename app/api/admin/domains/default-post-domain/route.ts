import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import {
  getAllowedSystemPostDomains,
  getSystemDefaultPostDomain,
  normalizeSystemDefaultPostDomain,
  saveSystemDefaultPostDomain,
} from '@/lib/post-default-domain-config'

const updateSchema = z
  .object({
    defaultDomain: z.string().trim().min(1).max(255),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

export async function GET() {
  const access = await requireAdmin('domains.read')
  if (!access.ok) return access.response

  const config = await getSystemDefaultPostDomain()
  return NextResponse.json({
    ...config,
    canWrite: hasAdminPermission(access.admin, 'domains.write'),
    options: getAllowedSystemPostDomains(),
  })
}

export async function PUT(req: NextRequest) {
  const access = await requireAdmin('domains.write')
  if (!access.ok) return access.response

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 },
    )
  }

  let normalizedDomain: string
  try {
    normalizedDomain = normalizeSystemDefaultPostDomain(parsed.data.defaultDomain)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Domain mặc định không hợp lệ' },
      { status: 400 },
    )
  }

  const before = await getSystemDefaultPostDomain()
  const saved = await saveSystemDefaultPostDomain({
    defaultDomain: normalizedDomain,
    updatedBy: access.admin.email,
  })

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'domains.default-post-domain.update',
    entityType: 'system',
    entityId: 'system_default_post_domain',
    reason: parsed.data.reason || 'Cập nhật domain mặc định khi tạo bài viết cho toàn bộ thành viên',
    before,
    after: saved,
  })

  return NextResponse.json({
    ...saved,
    canWrite: true,
    options: getAllowedSystemPostDomains(),
  })
}
