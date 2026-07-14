import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'
import { z } from 'zod'

// GET /api/links/[id]/folders - Get assigned folders for a link
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: linkId } = await context.params

    const link = await prisma.link.findUnique({
      where: { id: linkId },
      select: { userId: true, folderRotationStartDate: true },
    })

    if (!link) {
      return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user || link.userId !== user.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const assignments = await prisma.linkFolderAssignment.findMany({
      where: { linkId },
      orderBy: { order: 'asc' },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            urls: true,
            order: true,
            createdAt: true,
          },
        },
      },
    })

    return NextResponse.json(assignments.map(a => ({ ...a.folder, assignmentOrder: a.order })))
  } catch (error) {
    console.error('[GET /api/links/[id]/folders]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}

// POST /api/links/[id]/folders - Assign folders to link
const assignSchema = z.object({
  folderIds: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 folder'),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: linkId } = await context.params

    const link = await prisma.link.findUnique({
      where: { id: linkId },
      select: { userId: true, folderRotationStartDate: true },
    })

    if (!link) {
      return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user || link.userId !== user.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const body = await req.json()
    const validation = assignSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { folderIds } = validation.data

    // Verify folders belong to user
    const folders = await prisma.linkFolder.findMany({
      where: { userId: user.id, id: { in: folderIds } },
      select: { id: true, folderGroupId: true },
    })

    if (folders.length !== folderIds.length) {
      return NextResponse.json(
        { error: 'Một số folder không tồn tại' },
        { status: 400 }
      )
    }

    // Delete existing assignments
    await prisma.linkFolderAssignment.deleteMany({
      where: { linkId },
    })

    // Create new assignments
    for (let i = 0; i < folderIds.length; i++) {
      await prisma.linkFolderAssignment.create({
        data: {
          linkId,
          folderId: folderIds[i],
          order: i + 1,
        },
      })
    }

    if (!link.folderRotationStartDate) {
      const folderGroupIds = [
        ...new Set(folders.map((folder) => folder.folderGroupId).filter((groupId): groupId is string => !!groupId)),
      ]
      await prisma.link.update({
        where: { id: linkId },
        data: {
          folderRotationStartDate: await getAlignedFolderRotationStartDateForGroup(
            user.id,
            folderGroupIds.length === 1 ? folderGroupIds[0] : null,
            folderIds.length,
          ),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/links/[id]/folders]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
