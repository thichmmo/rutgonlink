import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET /api/folder-groups - List all folder groups
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const groups = await prisma.folderGroup.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { folders: true, categories: true },
        },
      },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('[GET /api/folder-groups]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}

// POST /api/folder-groups - Create new folder group
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Tên folder group không được để trống' }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.folderGroup.findFirst({
      where: { userId: user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const group = await prisma.folderGroup.create({
      data: {
        userId: user.id,
        name: name.trim(),
        order: (maxOrder?.order ?? -1) + 1,
      },
    })

    return NextResponse.json(group)
  } catch (error) {
    console.error('[POST /api/folder-groups]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
