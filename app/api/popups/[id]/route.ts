import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getManagedContentUserId, popupSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = popupSchema.parse(await req.json())
    const updated = await prisma.popupTemplate.updateMany({
      where: { id, userId },
      data: { ...data, imageUrl: data.imageUrl || null },
    })
    if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy popup' }, { status: 404 })
    return NextResponse.json(await prisma.popupTemplate.findUniqueOrThrow({ where: { id } }))
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
