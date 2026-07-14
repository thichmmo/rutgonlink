import { prisma } from '@/lib/prisma'
import { getActiveFolderIndex, getVietnamStartOfTodayUtc } from '@/lib/folder-rotation'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
export async function getAlignedFolderRotationStartDateForGroup(
  userId: string,
  folderGroupId: string | null | undefined,
  totalFolders: number,
) {
  if (!folderGroupId || totalFolders <= 0) return new Date()

  const links = await prisma.link.findMany({
    where: {
      userId,
      isActive: true,
      useFolderRotation: true,
      folderRotationStartDate: { not: null },
      category: { folderGroupId },
      folderAssignments: { some: { folder: { folderGroupId } } },
    },
    select: {
      folderRotationStartDate: true,
      folderAssignments: {
        where: { folder: { folderGroupId } },
        select: { id: true },
      },
    },
  })

  const activeIndexCounts = new Map<number, number>()
  for (const link of links) {
    if (!link.folderRotationStartDate || link.folderAssignments.length === 0) continue
    const activeIndex = getActiveFolderIndex(link.folderRotationStartDate, link.folderAssignments.length)
    activeIndexCounts.set(activeIndex, (activeIndexCounts.get(activeIndex) ?? 0) + 1)
  }

  const activeIndex = [...activeIndexCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0] - b[0]
  })[0]?.[0] ?? 0

  return new Date(getVietnamStartOfTodayUtc().getTime() - (activeIndex % totalFolders) * ONE_DAY_MS)
}

export async function getFolderActivePreviewForUser(userId: string, dayOffset = 0) {
  const safeDayOffset = Math.max(0, Math.floor(dayOffset) || 0)

  const [groups, links] = await Promise.all([
    prisma.folderGroup.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        folders: {
          orderBy: { order: 'asc' },
          select: { id: true, name: true, order: true },
        },
      },
    }),
    prisma.link.findMany({
      where: {
        userId,
        isActive: true,
        useFolderRotation: true,
        folderRotationStartDate: { not: null },
        folderAssignments: { some: {} },
      },
      select: {
        id: true,
        folderRotationStartDate: true,
        category: { select: { folderGroupId: true } },
        folderAssignments: {
          orderBy: { order: 'asc' },
          select: {
            order: true,
            folder: { select: { id: true, name: true, folderGroupId: true, order: true } },
          },
        },
      },
    }),
  ])

  return groups.map((group) => {
    const groupLinks = links
      .map((link) => {
        const assignments = link.folderAssignments.filter((assignment) => {
          const assignmentGroupId = assignment.folder.folderGroupId
          return assignmentGroupId === group.id || (!assignmentGroupId && link.category?.folderGroupId === group.id)
        })

        if (assignments.length === 0 || !link.folderRotationStartDate) return null

        const activeIndex = (getActiveFolderIndex(link.folderRotationStartDate, assignments.length) + safeDayOffset) % assignments.length
        const activeAssignment = assignments[activeIndex]
        return {
          linkId: link.id,
          activeIndex,
          folderId: activeAssignment.folder.id,
          folderName: activeAssignment.folder.name,
        }
      })
      .filter((item): item is { linkId: string; activeIndex: number; folderId: string; folderName: string } => !!item)

    const counts = new Map<string, { folderId: string; folderName: string; activeIndex: number; linkCount: number }>()
    for (const link of groupLinks) {
      const current = counts.get(link.folderId)
      if (current) {
        current.linkCount += 1
      } else {
        counts.set(link.folderId, {
          folderId: link.folderId,
          folderName: link.folderName,
          activeIndex: link.activeIndex,
          linkCount: 1,
        })
      }
    }

    const active = [...counts.values()].sort((a, b) => {
      if (b.linkCount !== a.linkCount) return b.linkCount - a.linkCount
      return a.activeIndex - b.activeIndex
    })[0] ?? null

    return {
      groupId: group.id,
      groupName: group.name,
      totalFolders: group.folders.length,
      rotatingLinkCount: groupLinks.length,
      activeFolderId: active?.folderId ?? null,
      activeFolderName: active?.folderName ?? null,
      activeIndex: active?.activeIndex ?? null,
      activeLinkCount: active?.linkCount ?? 0,
    }
  })
}
