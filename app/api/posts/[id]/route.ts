import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { getManagedContentUserId, ownsPopup, postSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = postSchema.parse(await req.json())
    if (!(await ownsPopup(userId, data.popupId))) {
      return NextResponse.json({ error: 'Popup không thuộc tài khoản này' }, { status: 400 })
    }
    const updated = await prisma.managedPost.updateMany({
      where: { id, userId },
      data: { ...data, popupId: data.popupId || null, excerpt: data.excerpt || null },
    })
    if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
    return NextResponse.json(await prisma.managedPost.findUniqueOrThrow({ where: { id } }))
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Đường dẫn bài viết đã tồn tại' }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const deleted = await prisma.managedPost.deleteMany({ where: { id, userId } })
  if (!deleted.count) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
