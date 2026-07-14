import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

async function getUser(session: { user?: { email?: string | null } | null } | null) {
  if (!session?.user?.email) return null
  return prisma.user.findUnique({ where: { email: session.user.email } })
}

// GET: list workspaces user belongs to
export async function GET() {
  const session = await getServerSession(authOptions)
  const user = await getUser(session)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await prisma.workspace.findMany({
    where: { ownerId: user.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { links: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const memberOf = await prisma.workspace.findMany({
    where: { members: { some: { userId: user.id } }, NOT: { ownerId: user.id } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { links: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ owned, memberOf })
}

// POST: create workspace
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = await getUser(session)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name } = body

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: 'Tên workspace phải có ít nhất 2 ký tự' }, { status: 400 })
  }

  const slug = name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') +
    '-' + Date.now().toString(36)

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      slug,
      ownerId: user.id,
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { links: true } },
    },
  })

  return NextResponse.json(workspace, { status: 201 })
}
