import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET: list all shares of a note
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const note = await prisma.note.findUnique({ where: { id } })
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  const shares = await prisma.noteShare.findMany({
    where: { noteId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(shares)
}

// POST: add email share
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { email, permission } = await request.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 })
  }

  const note = await prisma.note.findUnique({ where: { id } })
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  if (email.toLowerCase() === session.user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Không thể chia sẻ với chính mình' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!targetUser) {
    return NextResponse.json({ error: 'Không tìm thấy người dùng với email này' }, { status: 404 })
  }

  const share = await prisma.noteShare.upsert({
    where: { noteId_userId: { noteId: id, userId: targetUser.id } },
    update: { permission: permission || 'viewer' },
    create: { noteId: id, userId: targetUser.id, permission: permission || 'viewer' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(share, { status: 201 })
}
