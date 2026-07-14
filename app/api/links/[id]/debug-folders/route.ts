import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const link = await prisma.link.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      shortCode: true,
      useFolderRotation: true,
      folderRotationStartDate: true,
      category: {
        select: {
          id: true,
          name: true,
          folderGroupId: true,
          folderGroup: { select: { id: true, name: true } },
        },
      },
      folderAssignments: {
        select: {
          id: true,
          order: true,
          folder: {
            select: {
              id: true,
              name: true,
              folderGroupId: true,
              folderGroup: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  return NextResponse.json({
    linkId: link.id,
    shortCode: link.shortCode,
    useFolderRotation: link.useFolderRotation,
    folderRotationStartDate: link.folderRotationStartDate,
    category: link.category,
    folderAssignments: link.folderAssignments,
    diagnosis: {
      hasFolderRotation: link.useFolderRotation,
      hasCategory: !!link.category,
      categoryHasFolderGroup: !!link.category?.folderGroupId,
      folderCount: link.folderAssignments.length,
      foldersWithGroup: link.folderAssignments.filter(a => a.folder.folderGroupId).length,
      willFilter: !!link.category?.folderGroupId,
    },
  })
}
