import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// GET /api/folders - List all folders for current user
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

    const folders = await prisma.linkFolder.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        urls: true,
        order: true,
        folderGroupId: true,
        createdAt: true,
      },
    })

    return NextResponse.json(folders)
  } catch (error) {
    console.error('[GET /api/folders]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}

// POST /api/folders - Create new folder
const createSchema = z.object({
  name: z.string().min(1, 'Tên folder không được để trống').max(100, 'Tên folder tối đa 100 ký tự'),
  urls: z.string().refine(
    (val) => {
      const urls = val.split('\n').map(u => u.trim()).filter(Boolean)
      return urls.length > 0 && urls.every(u => {
        try { new URL(u); return true } catch { return false }
      })
    },
    'Folder phải có ít nhất 1 URL hợp lệ'
  ),
  folderGroupId: z.string().optional(),
})

export async function POST(req: NextRequest) {
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
    const validation = createSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, urls, folderGroupId } = validation.data

    // Get max order
    const maxOrderFolder = await prisma.linkFolder.findFirst({
      where: { userId: user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const nextOrder = (maxOrderFolder?.order ?? 0) + 1

    const folder = await prisma.linkFolder.create({
      data: {
        userId: user.id,
        name,
        urls,
        order: nextOrder,
        folderGroupId: folderGroupId || null,
      },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    console.error('[POST /api/folders]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
