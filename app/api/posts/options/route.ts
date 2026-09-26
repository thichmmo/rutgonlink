import { NextResponse } from 'next/server'
import { getManagedContentActor, getPublicationTargets } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [popups, domains] = await Promise.all([
    prisma.popupTemplate.findMany({ where: { userId: actor.id, isActive: true }, select: { id: true, name: true, imageUrl: true }, orderBy: { name: 'asc' } }),
    getPublicationTargets(actor.id),
  ])
  return NextResponse.json({ popups, domains, canUseRawHtml: actor.isAdmin })
}
