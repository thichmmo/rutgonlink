import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasAdminPermission, requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'
import {
  buildBeaconBaseUrlForDomain,
  getTrancoBoostConfig,
  normalizeTrancoDomainList,
  saveTrancoBoostConfig,
} from '@/lib/tranco-boost-config'

const SUGGESTED_CANDIDATES = [
  'honghotngay228.site',
  'mesale.vn',
  'rutgonlink.site',
  'phimngay.site',
  'baonewtin.site',
  'phimhaybaz.site',
]

const updateSchema = z
  .object({
    enabled: z.boolean(),
    domains: z.array(z.string().max(255)).max(15),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

export async function GET() {
  const access = await requireAdmin('system.read')
  if (!access.ok) return access.response

  const config = await getTrancoBoostConfig()
  return NextResponse.json({
    ...config,
    canWrite: hasAdminPermission(access.admin, 'system.write'),
    targets: config.domains.map((domain) => ({
      domain,
      beaconBaseUrl: buildBeaconBaseUrlForDomain(domain),
    })),
    suggestedDomains: SUGGESTED_CANDIDATES,
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

  let normalizedDomains: string[]
  try {
    normalizedDomains = normalizeTrancoDomainList(parsed.data.domains)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Danh sách tên miền không hợp lệ' },
      { status: 400 },
    )
  }

  if (parsed.data.enabled && normalizedDomains.length === 0) {
    return NextResponse.json(
      { error: 'Vui lòng thêm ít nhất 1 tên miền trước khi bật kéo Tranco Top-1M' },
      { status: 400 },
    )
  }

  const before = await getTrancoBoostConfig()
  const saved = await saveTrancoBoostConfig({
    enabled: parsed.data.enabled,
    domains: normalizedDomains,
    updatedBy: access.admin.email,
  })

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: 'system.tranco-boost.update',
    entityType: 'system',
    entityId: 'system_tranco_boost',
    reason: parsed.data.reason || 'Cập nhật danh sách domain kéo Tranco Top-1M',
    before,
    after: saved,
  })

  return NextResponse.json({
    ...saved,
    canWrite: true,
    targets: saved.domains.map((domain) => ({
      domain,
      beaconBaseUrl: buildBeaconBaseUrlForDomain(domain),
    })),
    suggestedDomains: SUGGESTED_CANDIDATES,
  })
}
