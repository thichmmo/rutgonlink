import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { invalidateLinkCache } from '@/lib/link-cache'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'
import { z } from 'zod'

// POST /api/v1/links/[id]/folders - Assign folders to a link.
// Assigning folders also enables folder rotation; clearing folders disables it.
const assignFoldersSchema = z.object({
  folderIds: z.array(z.string()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const link = await prisma.link.findFirst({
    where: { id, userId: user.id },
  })

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = assignFoldersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { folderIds } = parsed.data
  const uniqueFolderIds = [...new Set(folderIds)]
  let assignedFolders: Array<{ id: string; folderGroupId: string | null }> = []

  if (uniqueFolderIds.length !== folderIds.length) {
    return NextResponse.json({ error: 'Folder IDs must be unique' }, { status: 400 })
  }

  if (uniqueFolderIds.length > 0) {
    assignedFolders = await prisma.linkFolder.findMany({
      where: { id: { in: uniqueFolderIds }, userId: user.id },
      select: { id: true, folderGroupId: true },
    })

    if (assignedFolders.length !== uniqueFolderIds.length) {
      return NextResponse.json({ error: 'One or more folders were not found' }, { status: 400 })
    }
  }

  let folderRotationStartDate: Date | null = null
  if (uniqueFolderIds.length > 0) {
    if (link.folderRotationStartDate) {
      folderRotationStartDate = link.folderRotationStartDate
    } else {
      const folderGroupIds = [
        ...new Set(assignedFolders.map((folder) => folder.folderGroupId).filter((id): id is string => !!id)),
      ]
      folderRotationStartDate = await getAlignedFolderRotationStartDateForGroup(
        user.id,
        folderGroupIds.length === 1 ? folderGroupIds[0] : null,
        uniqueFolderIds.length,
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.linkFolderAssignment.deleteMany({
      where: { linkId: id },
    })

    if (uniqueFolderIds.length > 0) {
      await tx.linkFolderAssignment.createMany({
        data: uniqueFolderIds.map((folderId, order) => ({
          linkId: id,
          folderId,
          order,
        })),
      })
    }

    await tx.link.update({
      where: { id },
      data: {
        useFolderRotation: uniqueFolderIds.length > 0,
        folderRotationStartDate,
      },
    })
  })

  invalidateLinkCache(link.shortCode)

  return NextResponse.json({
    success: true,
    message: uniqueFolderIds.length > 0 ? 'Folders assigned' : 'Folders cleared',
    useFolderRotation: uniqueFolderIds.length > 0,
    folderRotationStartDate,
  })
}
