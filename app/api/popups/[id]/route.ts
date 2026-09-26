import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { getManagedContentUserId, normalizeSettings, popupSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

async function getPopup(id: string, userId: string) {
  return prisma.popupTemplate.findFirst({ where: { id, userId }, include: { _count: { select: { posts: true } } } })
}

function serializePopup(popup: NonNullable<Awaited<ReturnType<typeof getPopup>>>) {
  return { ...popup, settings: normalizeSettings(popup.settings, popup.firstUrl, popup.secondUrl) }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = popupSchema.parse(await req.json())
    const settings = normalizeSettings(data.settings, data.firstUrl, data.secondUrl)
    const updated = await prisma.popupTemplate.updateMany({
      where: { id, userId },
      data: {
        name: data.name,
        isActive: data.isActive,
        imageUrl: data.imageUrl || null,
        firstUrl: data.firstUrl,
        secondUrl: data.secondUrl,
        settings: settings as Prisma.InputJsonValue,
      },
    })
    if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy popup' }, { status: 404 })
    return NextResponse.json(serializePopup((await getPopup(id, userId))!))
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    throw error
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const deleted = await prisma.popupTemplate.deleteMany({ where: { id, userId } })
  if (!deleted.count) return NextResponse.json({ error: 'Không tìm thấy popup' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
