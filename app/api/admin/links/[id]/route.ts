import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'

const schema = z.object({
  action: z.enum(['disable', 'enable']),
  reason: z.string().trim().min(3).max(1000),
})

const snapshotSelect = {
  id: true,
  shortCode: true,
  userId: true,
  isActive: true,
  isArchived: true,
  disabledByAdmin: true,
  adminNote: true,
  moderatedAt: true,
} as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdmin('links.write')
  if (!access.ok) return access.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const { id } = await params
  const before = await prisma.link.findUnique({ where: { id }, select: snapshotSelect })
  if (!before) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

  if (parsed.data.action === 'enable' && !before.disabledByAdmin) {
    return NextResponse.json({ error: 'Link này không bị admin khóa' }, { status: 400 })
  }

  const after = await prisma.link.update({
    where: { id },
    data:
      parsed.data.action === 'disable'
        ? {
            isActive: false,
            disabledByAdmin: true,
            adminNote: parsed.data.reason,
            moderatedAt: new Date(),
          }
        : {
            isActive: true,
            disabledByAdmin: false,
            adminNote: null,
            moderatedAt: new Date(),
          },
    select: snapshotSelect,
  })

  await recordAdminAudit({
    admin: access.admin,
    request: req,
    action: `link.${parsed.data.action}`,
    entityType: 'link',
    entityId: id,
    reason: parsed.data.reason,
    before,
    after,
  })

  return NextResponse.json({ ok: true, link: after })
}
