import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/links/[id]/copy-folders - Copy folder assignments from another link
export async function POST(req: Request, { params }: Params) {
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

    const { id: targetLinkId } = await params
    const body = await req.json()
    const { sourceLinkId } = body

    if (!sourceLinkId) {
      return NextResponse.json({ error: 'sourceLinkId is required' }, { status: 400 })
    }

    // Verify both links belong to user
    const [targetLink, sourceLink] = await Promise.all([
      prisma.link.findFirst({ where: { id: targetLinkId, userId: user.id } }),
      prisma.link.findFirst({ where: { id: sourceLinkId, userId: user.id } }),
    ])

    if (!targetLink || !sourceLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Get source link's folder assignments
    const sourceAssignments = await prisma.linkFolderAssignment.findMany({
      where: { linkId: sourceLinkId },
      orderBy: { order: 'asc' },
      select: { folderId: true, order: true, folder: { select: { folderGroupId: true } } },
    })

    if (sourceAssignments.length === 0) {
      return NextResponse.json({ success: true, copied: 0 })
    }

    // Delete existing assignments for target link
    await prisma.linkFolderAssignment.deleteMany({
      where: { linkId: targetLinkId },
    })

    // Create new assignments
    await prisma.linkFolderAssignment.createMany({
      data: sourceAssignments.map((a) => ({
        linkId: targetLinkId,
        folderId: a.folderId,
        order: a.order,
      })),
    })

    const folderGroupIds = [
      ...new Set(sourceAssignments.map((assignment) => assignment.folder.folderGroupId).filter((groupId): groupId is string => !!groupId)),
    ]
    const folderRotationStartDate = sourceLink.useFolderRotation
      ? await getAlignedFolderRotationStartDateForGroup(
        user.id,
        folderGroupIds.length === 1 ? folderGroupIds[0] : null,
        sourceAssignments.length,
      )
      : sourceLink.folderRotationStartDate

    // Copy folder rotation settings
    await prisma.link.update({
      where: { id: targetLinkId },
      data: {
        useFolderRotation: sourceLink.useFolderRotation,
        folderRotationStartDate,
      },
    })

    return NextResponse.json({ success: true, copied: sourceAssignments.length })
  } catch (error) {
    console.error('[POST /api/links/[id]/copy-folders]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
