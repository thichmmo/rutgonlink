import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { fixedContentSchema, getManagedContentActor, normalizeContent, normalizeContentFormat } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items = await prisma.managedContentBlock.findMany({ where: { userId: actor.id }, orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = fixedContentSchema.parse(await req.json())
    const format = normalizeContentFormat(data.contentFormat)
    const content = normalizeContent(data.content, format, actor.isAdmin)
    const item = await prisma.managedContentBlock.create({ data: { ...data, content, contentFormat: format, userId: actor.id } })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}
