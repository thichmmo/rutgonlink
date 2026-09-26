import { NextResponse } from 'next/server'
import { getManagedContentUserId, getPublicationTargets } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [popups, domains] = await Promise.all([
    prisma.popupTemplate.findMany({ where: { userId, isActive: true }, select: { id: true, name: true, imageUrl: true }, orderBy: { name: 'asc' } }),
    getPublicationTargets(userId),
  ])
  return NextResponse.json({ popups, domains })
}
