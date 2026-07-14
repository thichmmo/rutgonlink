import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// POST /api/folder-groups/reorder - Reorder folder groups
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
    const { groupIds } = body

    if (!Array.isArray(groupIds)) {
      return NextResponse.json({ error: 'groupIds phải là array' }, { status: 400 })
    }

    // Update order for each group
    await Promise.all(
      groupIds.map((id, index) =>
        prisma.folderGroup.updateMany({
          where: { id, userId: user.id },
          data: { order: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/folder-groups/reorder]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
