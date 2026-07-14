import { prisma } from '@/lib/prisma'
import { invalidateLinkCache } from '@/lib/link-cache'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'
import {
  clearFolderCache,
  getActiveFolderIndex,
  getFolderRotationStartDateForActiveIndex,
} from '@/lib/folder-rotation'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function enableAllFolderRotationForUser(userId: string) {
  const folders = await prisma.linkFolder.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
    select: { id: true, folderGroupId: true },
  })

  if (folders.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: 'Khong co folder nao de gan',
    }
  }

  const links = await prisma.link.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      shortCode: true,
      folderRotationStartDate: true,
      category: { select: { folderGroupId: true } },
      folderAssignments: {
        select: { folderId: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  let updated = 0
  let skipped = 0
  for (const link of links) {
    const categoryFolderGroupId = link.category?.folderGroupId
    const folderIds = categoryFolderGroupId
      ? folders.filter((folder) => folder.folderGroupId === categoryFolderGroupId).map((folder) => folder.id)
      : link.folderAssignments.map((assignment) => assignment.folderId)

    if (folderIds.length === 0) {
      skipped++
      continue
    }

    const folderRotationStartDate = link.folderRotationStartDate
      ?? await getAlignedFolderRotationStartDateForGroup(
        userId,
        categoryFolderGroupId,
        folderIds.length,
      )

    await prisma.$transaction(async (tx) => {
      await tx.linkFolderAssignment.deleteMany({
        where: { linkId: link.id },
      })

      await tx.linkFolderAssignment.createMany({
        data: folderIds.map((folderId, index) => ({
          linkId: link.id,
          folderId,
          order: index,
        })),
      })

      await tx.link.update({
        where: { id: link.id },
        data: {
          useFolderRotation: true,
          folderRotationStartDate,
        },
      })
    })

    invalidateLinkCache(link.shortCode)
    updated++
  }

  return {
    ok: true as const,
    updated,
    skipped,
    message: `Da bat folder rotation cho ${updated} link${skipped > 0 ? `, bo qua ${skipped} link chua co folder phu hop` : ''}`,
  }
}

export async function syncCategoryLinksToFolderGroup(
  userId: string,
  categoryId: string,
  linkIds?: string[],
) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { folderGroupId: true },
  })

  if (!category?.folderGroupId) {
    return {
      ok: true as const,
      syncedLinks: 0,
      clearedLinks: 0,
      foldersPerLink: 0,
      reason: 'category-has-no-folder-group',
    }
  }

  const links = await prisma.link.findMany({
    where: {
      userId,
      categoryId,
      ...(linkIds ? { id: { in: linkIds } } : {}),
    },
    select: { id: true, shortCode: true },
  })

  if (links.length === 0) {
    return {
      ok: true as const,
      syncedLinks: 0,
      clearedLinks: 0,
      foldersPerLink: 0,
      reason: 'no-links',
    }
  }

  const folders = await prisma.linkFolder.findMany({
    where: { userId, folderGroupId: category.folderGroupId },
    orderBy: { order: 'asc' },
    select: { id: true },
  })

  const ids = links.map((link) => link.id)
  if (folders.length === 0) {
    await prisma.$transaction(async (tx) => {
      await tx.linkFolderAssignment.deleteMany({ where: { linkId: { in: ids } } })
      await tx.link.updateMany({
        where: { id: { in: ids } },
        data: { useFolderRotation: false, folderRotationStartDate: null },
      })
    })

    links.forEach((link) => invalidateLinkCache(link.shortCode))
    return {
      ok: true as const,
      syncedLinks: 0,
      clearedLinks: links.length,
      foldersPerLink: 0,
      reason: 'folder-group-has-no-folders',
    }
  }

  const folderRotationStartDate = await getAlignedFolderRotationStartDateForGroup(
    userId,
    category.folderGroupId,
    folders.length,
  )
  const assignments = links.flatMap((link) =>
    folders.map((folder, order) => ({
      linkId: link.id,
      folderId: folder.id,
      order,
    })),
  )

  await prisma.$transaction(async (tx) => {
    // Replace stale assignments so category group changes cannot keep using an older group.
    await tx.linkFolderAssignment.deleteMany({ where: { linkId: { in: ids } } })

    const chunkSize = 1000
    for (let i = 0; i < assignments.length; i += chunkSize) {
      await tx.linkFolderAssignment.createMany({ data: assignments.slice(i, i + chunkSize) })
    }

    await tx.link.updateMany({
      where: { id: { in: ids } },
      data: {
        useFolderRotation: true,
        folderRotationStartDate,
      },
    })
  })

  links.forEach((link) => invalidateLinkCache(link.shortCode))
  return {
    ok: true as const,
    syncedLinks: links.length,
    clearedLinks: 0,
    foldersPerLink: folders.length,
  }
}

export async function advanceFolderRotationForUser(userId: string) {
  const links = await prisma.link.findMany({
    where: {
      userId,
      useFolderRotation: true,
      folderRotationStartDate: { not: null },
      folderAssignments: { some: {} },
    },
    select: { id: true, shortCode: true, folderRotationStartDate: true },
  })

  await Promise.all(
    links.map((link) => {
      const newStartDate = new Date(link.folderRotationStartDate!.getTime() - ONE_DAY_MS)

      return prisma.link
        .update({
          where: { id: link.id },
          data: { folderRotationStartDate: newStartDate },
        })
        .then(() => invalidateLinkCache(link.shortCode))
    }),
  )

  return {
    updated: links.length,
    message: `Da chuyen ${links.length} link sang folder tiep theo`,
  }
}

export async function deleteFolderPreservingRotationForUser(userId: string, folderId: string) {
  const folder = await prisma.linkFolder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  })

  if (!folder) {
    return {
      ok: false as const,
      status: 404,
      error: 'Folder not found',
    }
  }

  const links = await prisma.link.findMany({
    where: {
      userId,
      useFolderRotation: true,
      folderRotationStartDate: { not: null },
      folderAssignments: { some: { folderId } },
    },
    select: {
      id: true,
      shortCode: true,
      folderRotationStartDate: true,
      category: { select: { folderGroupId: true } },
      folderAssignments: {
        orderBy: { order: 'asc' },
        select: {
          order: true,
          folderId: true,
          folder: { select: { folderGroupId: true } },
        },
      },
    },
  })

  const updates: Array<{ linkId: string; startDate: Date }> = []
  const affectedShortCodes = new Set<string>()

  for (const link of links) {
    affectedShortCodes.add(link.shortCode)
    if (!link.folderRotationStartDate) continue

    const scopedAssignments = link.category?.folderGroupId
      ? link.folderAssignments.filter((assignment) => assignment.folder.folderGroupId === link.category?.folderGroupId)
      : link.folderAssignments

    if (!scopedAssignments.some((assignment) => assignment.folderId === folderId)) continue

    const currentIndex = getActiveFolderIndex(link.folderRotationStartDate, scopedAssignments.length)
    const currentActiveFolderId = scopedAssignments[currentIndex]?.folderId
    const remainingAssignments = scopedAssignments.filter((assignment) => assignment.folderId !== folderId)
    if (remainingAssignments.length === 0) continue

    const remainingActiveIndex = currentActiveFolderId && currentActiveFolderId !== folderId
      ? remainingAssignments.findIndex((assignment) => assignment.folderId === currentActiveFolderId)
      : currentIndex >= remainingAssignments.length
        ? 0
        : currentIndex

    if (remainingActiveIndex < 0) continue

    // Keep today's active folder stable when deleting a previous folder shifts assignment indexes.
    const nextStartDate = getFolderRotationStartDateForActiveIndex(
      remainingActiveIndex,
      remainingAssignments.length,
    )
    updates.push({ linkId: link.id, startDate: nextStartDate })
  }

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.link.update({
        where: { id: update.linkId },
        data: { folderRotationStartDate: update.startDate },
      })
    }

    await tx.linkFolder.delete({ where: { id: folderId } })
  })

  clearFolderCache()
  affectedShortCodes.forEach(invalidateLinkCache)

  return {
    ok: true as const,
    affectedLinks: affectedShortCodes.size,
    adjustedLinks: updates.length,
  }
}
