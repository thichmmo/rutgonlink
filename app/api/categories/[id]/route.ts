import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { invalidateLinkCache } from '@/lib/link-cache'
import { syncCategoryLinksToFolderGroup } from '@/lib/folder-rotation-actions'

async function getUserId(session: { user?: { email?: string | null } | null } | null) {
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user?.id ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const cat = await prisma.category.findFirst({ where: { id, userId } })
  if (!cat) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  const { name, color, folderGroupId } = await req.json()
  const nextFolderGroupId = folderGroupId !== undefined ? folderGroupId || null : cat.folderGroupId
  const shouldSyncFolderAssignments = folderGroupId !== undefined && !!nextFolderGroupId && (
    nextFolderGroupId !== cat.folderGroupId ||
    await prisma.link.count({
      where: {
        userId,
        categoryId: id,
        OR: [
          { folderAssignments: { none: { folder: { folderGroupId: nextFolderGroupId } } } },
          { folderAssignments: { some: { folder: { folderGroupId: { not: nextFolderGroupId } } } } },
        ],
      },
    }) > 0
  )
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(folderGroupId !== undefined ? { folderGroupId: nextFolderGroupId } : {}),
    },
    include: { _count: { select: { links: true } } },
  })

  if (shouldSyncFolderAssignments) {
    await syncCategoryLinksToFolderGroup(userId, id)
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const cat = await prisma.category.findFirst({ where: { id, userId } })
  if (!cat) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const deleteLinks = body?.deleteLinks === true
  const links = await prisma.link.findMany({
    where: { userId, categoryId: id },
    select: { id: true, shortCode: true },
  })

  await prisma.$transaction(async (tx) => {
    if (deleteLinks) {
      // Explicit destructive option: delete all category links before deleting the category.
      await tx.link.deleteMany({ where: { userId, categoryId: id } })
    } else {
      await tx.link.updateMany({ where: { userId, categoryId: id }, data: { categoryId: null } })
    }
    await tx.category.delete({ where: { id } })
  })

  links.forEach((link) => invalidateLinkCache(link.shortCode))

  return NextResponse.json({
    success: true,
    deletedLinks: deleteLinks ? links.length : 0,
    detachedLinks: deleteLinks ? 0 : links.length,
  })
}
