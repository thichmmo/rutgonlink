import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// POST /api/categories/auto-assign-groups
// Tự động gán folder group cho categories dựa trên folders mà links đang dùng
export async function POST() {
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

    // Lấy tất cả categories chưa có folderGroupId
    const categories = await prisma.category.findMany({
      where: {
        userId: user.id,
        folderGroupId: null,
      },
      include: {
        links: {
          include: {
            folderAssignments: {
              include: {
                folder: {
                  select: { folderGroupId: true },
                },
              },
            },
          },
        },
      },
    })

    const updates: Array<{ categoryId: string; folderGroupId: string; reason: string }> = []

    // Với mỗi category, tìm folder group phổ biến nhất
    for (const category of categories) {
      const folderGroupCounts = new Map<string, number>()

      // Đếm số lần xuất hiện của mỗi folder group trong links của category
      for (const link of category.links) {
        for (const assignment of link.folderAssignments) {
          const groupId = assignment.folder.folderGroupId
          if (groupId) {
            folderGroupCounts.set(groupId, (folderGroupCounts.get(groupId) || 0) + 1)
          }
        }
      }

      // Nếu có folder group nào được dùng, chọn cái phổ biến nhất
      if (folderGroupCounts.size > 0) {
        let maxCount = 0
        let selectedGroupId = ''

        for (const [groupId, count] of folderGroupCounts.entries()) {
          if (count > maxCount) {
            maxCount = count
            selectedGroupId = groupId
          }
        }

        if (selectedGroupId) {
          await prisma.category.update({
            where: { id: category.id },
            data: { folderGroupId: selectedGroupId },
          })

          updates.push({
            categoryId: category.id,
            folderGroupId: selectedGroupId,
            reason: `Folder group xuất hiện ${maxCount} lần trong ${category.links.length} links`,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã tự động gán folder group cho ${updates.length} categories`,
      updates,
    })
  } catch (error) {
    console.error('[POST /api/categories/auto-assign-groups]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
