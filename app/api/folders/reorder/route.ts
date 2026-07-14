import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// POST /api/folders/reorder - Reorder folders
const reorderSchema = z.object({
  folderIds: z.array(z.string()).min(1, 'Danh sách folder không được rỗng'),
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
    const validation = reorderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { folderIds } = validation.data

    // Verify all folders belong to this user
    const folders = await prisma.linkFolder.findMany({
      where: { userId: user.id, id: { in: folderIds } },
      select: { id: true },
    })

    if (folders.length !== folderIds.length) {
      return NextResponse.json(
        { error: 'Một số folder không thuộc về bạn' },
        { status: 400 }
      )
    }

    // Update order for each folder
    for (let i = 0; i < folderIds.length; i++) {
      await prisma.linkFolder.update({
        where: { id: folderIds[i] },
        data: { order: i + 1 },
      })
    }

    // Return updated folders
    const updated = await prisma.linkFolder.findMany({
      where: { userId: user.id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[POST /api/folders/reorder]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
