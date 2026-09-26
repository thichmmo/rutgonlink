import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getManagedContentUserId, normalizeSettings } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const source = await prisma.popupTemplate.findFirst({ where: { id, userId } })
  if (!source) return NextResponse.json({ error: 'Không tìm thấy popup' }, { status: 404 })
  const copy = await prisma.popupTemplate.create({
    data: {
      userId,
      name: `${source.name} - bản sao`,
      isActive: false,
      imageUrl: source.imageUrl,
      firstUrl: source.firstUrl,
      secondUrl: source.secondUrl,
      settings: normalizeSettings(source.settings, source.firstUrl, source.secondUrl) as Prisma.InputJsonValue,
    },
    include: { _count: { select: { posts: true } } },
  })
  return NextResponse.json({ ...copy, settings: normalizeSettings(copy.settings, copy.firstUrl, copy.secondUrl) }, { status: 201 })
}
