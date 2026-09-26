import { NextResponse } from 'next/server'
import { getManagedContentUserId, normalizeSettings } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const popup = await prisma.popupTemplate.findFirst({ where: { id, userId }, include: { _count: { select: { posts: true } } } })
  if (!popup) return NextResponse.json({ error: 'Không tìm thấy popup' }, { status: 404 })
  return NextResponse.json({ id: popup.id, name: popup.name, isActive: popup.isActive, firstUrl: popup.firstUrl, secondUrl: popup.secondUrl, settings: normalizeSettings(popup.settings, popup.firstUrl, popup.secondUrl), postsUsing: popup._count.posts })
}
