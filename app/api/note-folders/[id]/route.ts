import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 })

  const existing = await prisma.noteFolder.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy thư mục' }, { status: 404 })
  }

  const data: { name: string; color?: string } = { name: name.trim() }
  if (color) data.color = color

  const folder = await prisma.noteFolder.update({
    where: { id },
    data,
    include: { _count: { select: { notes: true } } },
  })

  return NextResponse.json(folder)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.noteFolder.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy thư mục' }, { status: 404 })
  }

  // Notes in this folder will have folderId set to null (onDelete: SetNull)
  await prisma.noteFolder.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
