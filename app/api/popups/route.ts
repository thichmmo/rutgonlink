import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { getManagedContentUserId, normalizeSettings, popupSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

function pageValue(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.floor(parsed))) : fallback
}

function serializePopup(popup: Prisma.PopupTemplateGetPayload<{ include: { _count: { select: { posts: true } } } }>) {
  return { ...popup, settings: normalizeSettings(popup.settings, popup.firstUrl, popup.secondUrl) }
}

export async function GET(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('query')?.trim() || ''
  const status = req.nextUrl.searchParams.get('status') || 'all'
  const page = pageValue(req.nextUrl.searchParams.get('page'), 1, 10000)
  const pageSize = pageValue(req.nextUrl.searchParams.get('pageSize'), 10, 50)
  const where = {
    userId,
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(query ? { OR: [{ name: { contains: query } }, { firstUrl: { contains: query } }, { secondUrl: { contains: query } }] } : {}),
  }
  const [total, popups] = await prisma.$transaction([
    prisma.popupTemplate.count({ where }),
    prisma.popupTemplate.findMany({
      where,
      include: { _count: { select: { posts: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return NextResponse.json({ items: popups.map(serializePopup), total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = popupSchema.parse(await req.json())
    const settings = normalizeSettings(data.settings, data.firstUrl, data.secondUrl)
    const popup = await prisma.popupTemplate.create({
      data: {
        name: data.name,
        isActive: data.isActive,
        imageUrl: data.imageUrl || null,
        firstUrl: data.firstUrl,
        secondUrl: data.secondUrl,
        settings: settings as Prisma.InputJsonValue,
        userId,
      },
      include: { _count: { select: { posts: true } } },
    })
    return NextResponse.json(serializePopup(popup), { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    throw error
  }
}
