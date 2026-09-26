import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { fixedContentSchema, getManagedContentActor, normalizeContent, normalizeContentFormat } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = fixedContentSchema.parse(await req.json())
    const format = normalizeContentFormat(data.contentFormat)
    const content = normalizeContent(data.content, format, actor.isAdmin)
    const updated = await prisma.managedContentBlock.updateMany({ where: { id, userId: actor.id }, data: { ...data, content, contentFormat: format } })
    if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy nội dung cố định' }, { status: 404 })
    return NextResponse.json(await prisma.managedContentBlock.findUniqueOrThrow({ where: { id } }))
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const deleted = await prisma.managedContentBlock.deleteMany({ where: { id, userId: actor.id } })
  if (!deleted.count) return NextResponse.json({ error: 'Không tìm thấy nội dung cố định' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
