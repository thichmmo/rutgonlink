import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { getManagedContentUserId, ownsPopup, postSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const posts = await prisma.managedPost.findMany({
    where: { userId },
    include: { popup: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = postSchema.parse(await req.json())
    if (!(await ownsPopup(userId, data.popupId))) {
      return NextResponse.json({ error: 'Popup không thuộc tài khoản này' }, { status: 400 })
    }
    const post = await prisma.managedPost.create({
      data: { ...data, popupId: data.popupId || null, excerpt: data.excerpt || null, userId },
    })
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Đường dẫn bài viết đã tồn tại' }, { status: 409 })
    }
    throw error
  }
}
