import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PATCH: update permission
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, shareId } = await params
  const { permission } = await request.json()

  const note = await prisma.note.findUnique({ where: { id } })
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  const share = await prisma.noteShare.update({
    where: { id: shareId },
    data: { permission },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(share)
}

// DELETE: remove share
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, shareId } = await params

  const note = await prisma.note.findUnique({ where: { id } })
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  await prisma.noteShare.delete({ where: { id: shareId } })
  return NextResponse.json({ success: true })
}
