import { NextRequest, NextResponse } from 'next/server'
import { getManagedContentUserId } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { ids?: unknown[] } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
  const owned = await prisma.managedContentBlock.findMany({ where: { userId, id: { in: ids } }, select: { id: true } })
  const ownedIds = new Set(owned.map(item => item.id))
  await prisma.$transaction(ids.filter(id => ownedIds.has(id)).map((id, index) => prisma.managedContentBlock.update({ where: { id }, data: { sortOrder: index } })))
  return NextResponse.json({ ok: true })
}
