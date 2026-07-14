import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Debug endpoint để kiểm tra folder assignments và folder groups
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shortCode = searchParams.get('shortCode')

  if (!shortCode) {
    return NextResponse.json({ error: 'shortCode is required' }, { status: 400 })
  }

  // Lấy link với tất cả thông tin liên quan
  const link = await prisma.link.findFirst({
    where: { shortCode },
    include: {
      category: {
        include: {
          folderGroup: true
        }
      },
      folderAssignments: {
        include: {
          folder: {
            include: {
              folderGroup: true
            }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  // Format dữ liệu để dễ đọc
  const debug = {
    linkId: link.id,
    shortCode: link.shortCode,
    useFolderRotation: link.useFolderRotation,
    category: link.category ? {
      id: link.category.id,
      name: link.category.name,
      folderGroupId: link.category.folderGroupId,
      folderGroup: link.category.folderGroup ? {
        id: link.category.folderGroup.id,
        name: link.category.folderGroup.name
      } : null
    } : null,
    folderAssignments: link.folderAssignments.map(a => ({
      order: a.order,
      folder: {
        id: a.folder.id,
        name: a.folder.name,
        folderGroupId: a.folder.folderGroupId,
        folderGroup: a.folder.folderGroup ? {
          id: a.folder.folderGroup.id,
          name: a.folder.folderGroup.name
        } : null,
        urlCount: a.folder.urls.split('\n').filter(Boolean).length
      }
    }))
  }

  return NextResponse.json(debug, { status: 200 })
}
