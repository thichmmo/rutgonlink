import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

async function getUserId(session: { user?: { email?: string | null } | null } | null) {
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user?.id ?? null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await prisma.category.findMany({
    where: { userId },
    include: {
      _count: { select: { links: true } },
      links: { select: { isActive: true, _count: { select: { clicks: true } } } },
      folderGroup: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const categories = raw.map(cat => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    folderGroupId: cat.folderGroupId,
    folderGroup: cat.folderGroup,
    createdAt: cat.createdAt,
    _count: { links: cat._count.links },
    totalClicks: cat.links.reduce((s, l) => s + l._count.clicks, 0),
    activeLinks: cat.links.filter(l => l.isActive).length,
  }))

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color, folderGroupId } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Tên danh mục không được trống' }, { status: 400 })

  const category = await prisma.category.create({
    data: {
      userId,
      name: name.trim(),
      color: color || '#6366f1',
      folderGroupId: folderGroupId || null,
    },
    include: { _count: { select: { links: true } } },
  })

  return NextResponse.json(category, { status: 201 })
}
