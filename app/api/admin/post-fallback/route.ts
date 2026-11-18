import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import { getSiteHostname } from '@/lib/site-config'
import { getPublicPostPath } from '@/lib/public-post-link'
import {
  getSystemPostFallbackConfig,
  inspectFallbackTargetUrl,
  normalizeFallbackTargetUrl,
  saveSystemPostFallbackConfig,
} from '@/lib/post-fallback-config'

const updateSchema = z
  .object({
    enabled: z.boolean(),
    targetUrl: z.string().max(2048).default(''),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

export async function GET() {
  const access = await requireAdmin('system.read')
  if (!access.ok) return access.response

  const [config, rawPosts] = await Promise.all([
    getSystemPostFallbackConfig(),
    prisma.managedPost.findMany({
      where: { userId: access.admin.id, isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        isDirectWrapper: true,
        sharedDomain: true,
        domain: { select: { domain: true } },
        popup: { select: { name: true, isActive: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
    }),
  ])

  const inspection = await inspectFallbackTargetUrl(config.targetUrl)
  const adminPosts = rawPosts.map((post) => {
    const host = post.domain?.domain || post.sharedDomain || getSiteHostname()
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      publicUrl: `https://${host}${getPublicPostPath(post.slug)}`,
      isDirectWrapper: Boolean(post.isDirectWrapper),
      popupName: post.popup?.isActive ? post.popup.name : null,
    }
  })

  return NextResponse.json({
    ...config,
    canWrite: hasAdminPermission(access.admin, 'system.write'),
    inspection,
    adminPosts,
  })
}

export async function PUT(req: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 },
    )
  }

  let normalizedUrl: string
  try {
    normalizedUrl = normalizeFallbackTargetUrl(parsed.data.targetUrl)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'URL đích không hợp lệ' },
      { status: 400 },
    )
  }

  if (parsed.data.enabled && !normalizedUrl) {
    return NextResponse.json(
      { error: 'Vui lòng nhập URL đích trước khi bật hứng link bài viết cũ' },
      { status: 400 },
    )
  }

  const inspection = await inspectFallbackTargetUrl(normalizedUrl)
  if (parsed.data.enabled && inspection.mode === 'missing_post') {
    return NextResponse.json(
      { error: 'Bài viết nội bộ đích không tồn tại hoặc chưa xuất bản' },
      { status: 400 },
    )
  }

  const before = await getSystemPostFallbackConfig()
  const saved = await saveSystemPostFallbackConfig({
    enabled: parsed.data.enabled,
    targetUrl: normalizedUrl,
    updatedBy: access.admin.email,
  })

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'system.post-fallback.update',
    entityType: 'system',
    entityId: 'system_post_fallback',
    reason: parsed.data.reason || 'Cập nhật cấu hình hứng link bài viết cũ toàn hệ thống',
    before,
    after: saved,
  })

  return NextResponse.json({
    ...saved,
    canWrite: true,
    inspection,
  })
}
