import { prisma } from '@/lib/prisma'
import { getActiveFolderIndex } from '@/lib/folder-rotation'

export async function getActiveFolderForLink(userId: string, linkId: string) {
  const link = await prisma.link.findFirst({
    where: { id: linkId, userId },
    select: {
      id: true,
      shortCode: true,
      useFolderRotation: true,
      folderRotationStartDate: true,
      originalUrl: true,
      category: { select: { folderGroupId: true, folderGroup: { select: { id: true, name: true } } } },
      folderAssignments: {
        orderBy: { order: 'asc' },
        select: {
          order: true,
          folder: {
            select: {
              id: true,
              name: true,
              urls: true,
              folderGroupId: true,
              folderGroup: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })

  if (!link) {
    return { ok: false as const, status: 404, error: 'Link not found' }
  }

  if (!link.useFolderRotation || !link.folderRotationStartDate || link.folderAssignments.length === 0) {
    return {
      ok: true as const,
      active: false,
      shortCode: link.shortCode,
      urls: link.originalUrl,
      activeIndex: null,
      totalFolders: 0,
      folderName: null,
      folderId: null,
    }
  }

  let assignments = link.folderAssignments
  if (link.category?.folderGroupId) {
    assignments = assignments.filter((assignment) => assignment.folder.folderGroupId === link.category?.folderGroupId)
  }

  if (assignments.length === 0) {
    return {
      ok: true as const,
      active: false,
      shortCode: link.shortCode,
      urls: link.originalUrl,
      activeIndex: null,
      totalFolders: 0,
      folderName: null,
      folderId: null,
    }
  }

  const activeIndex = getActiveFolderIndex(link.folderRotationStartDate, assignments.length)
  const activeAssignment = assignments[activeIndex]

  return {
    ok: true as const,
    active: true,
    shortCode: link.shortCode,
    urls: activeAssignment.folder.urls,
    activeIndex,
    totalFolders: assignments.length,
    folderName: activeAssignment.folder.name,
    folderId: activeAssignment.folder.id,
    folderGroupId: activeAssignment.folder.folderGroupId,
    folderGroupName: activeAssignment.folder.folderGroup?.name ?? link.category?.folderGroup?.name ?? null,
    folderRotationStartDate: link.folderRotationStartDate,
  }
}
