import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await prisma.bioPage.findFirst({
    where: { userId: user.id },
    include: { links: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(page)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { username, title, description, avatar, theme, isPublic } = body

  if (!username || !/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return NextResponse.json({ error: 'Username không hợp lệ (3-30 ký tự, chỉ chữ, số, - _)' }, { status: 400 })
  }

  const existing = await prisma.bioPage.findUnique({ where: { username } })
  if (existing && existing.userId !== user.id) {
    return NextResponse.json({ error: 'Username đã được sử dụng' }, { status: 400 })
  }

  const page = await prisma.bioPage.upsert({
    where: { username },
    create: { userId: user.id, username, title, description, avatar, theme: theme || 'default', isPublic: isPublic !== false },
    update: { title, description, avatar, theme: theme || 'default', isPublic: isPublic !== false },
    include: { links: { orderBy: { sortOrder: 'asc' } } },
  })

  return NextResponse.json(page)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { bioPageId, links } = body

  const page = await prisma.bioPage.findFirst({ where: { id: bioPageId, userId: user.id } })
  if (!page) return NextResponse.json({ error: 'Không tìm thấy Bio page' }, { status: 404 })

  // Replace all links
  await prisma.bioLink.deleteMany({ where: { bioPageId } })
  if (links?.length > 0) {
    await prisma.bioLink.createMany({
      data: links.map((l: { title: string; url: string; icon?: string; isActive?: boolean }, i: number) => ({
        bioPageId,
        title: l.title,
        url: l.url,
        icon: l.icon || null,
        sortOrder: i,
        isActive: l.isActive !== false,
      })),
    })
  }

  const updated = await prisma.bioPage.findFirst({
    where: { id: bioPageId },
    include: { links: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(updated)
}
