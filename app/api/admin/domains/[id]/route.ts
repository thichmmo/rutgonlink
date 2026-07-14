import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'

const schema = z.object({
  action: z.enum(['disable', 'enable']),
  reason: z.string().trim().min(3).max(500),
})

const snapshotSelect = {
  id: true,
  domain: true,
  userId: true,
  verified: true,
  disabledAt: true,
  disabledReason: true,
} as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin('domains.write')
  if (!access.ok) return access.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }
  const { id } = await params
  const before = await prisma.domain.findUnique({ where: { id }, select: snapshotSelect })
  if (!before) return NextResponse.json({ error: 'Domain not found' }, { status: 404 })

  const after = await prisma.domain.update({
    where: { id },
    data:
      parsed.data.action === 'disable'
        ? { verified: false, disabledAt: new Date(), disabledReason: parsed.data.reason }
        : { disabledAt: null, disabledReason: null },
    select: snapshotSelect,
  })

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: `domain.${parsed.data.action}`,
    entityType: 'domain',
    entityId: id,
    reason: parsed.data.reason,
    before,
    after,
  })

  return NextResponse.json({ ok: true, domain: after })
}
