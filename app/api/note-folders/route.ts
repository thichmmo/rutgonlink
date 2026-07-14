import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folders = await prisma.noteFolder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { notes: true } } },
  })

  return NextResponse.json(folders)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Tên thư mục không được để trống' }, { status: 400 })

  const folder = await prisma.noteFolder.create({
    data: { userId: session.user.id, name: name.trim(), color: color || '#6366f1' },
    include: { _count: { select: { notes: true } } },
  })

  return NextResponse.json(folder, { status: 201 })
}
