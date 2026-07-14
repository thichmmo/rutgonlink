import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { deleteFolderPreservingRotationForUser } from '@/lib/folder-rotation-actions'

// GET /api/v1/folders/[id] - Lấy chi tiết folder bao gồm danh sách URLs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Xác thực API key
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  // Lấy folder với đầy đủ thông tin
  const folder = await prisma.linkFolder.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      urls: true,
      order: true,
      folderGroupId: true,
      createdAt: true,
      folderGroup: {
        select: { id: true, name: true },
      },
    },
  })

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  // Parse URLs từ text thành array
  const urlList = folder.urls.split('\n').map((u: string) => u.trim()).filter(Boolean)

  return NextResponse.json({
    data: {
      id: folder.id,
      name: folder.name,
      order: folder.order,
      folderGroupId: folder.folderGroupId,
      folderGroup: folder.folderGroup,
      createdAt: folder.createdAt,
      urls: urlList,
      urlsCount: urlList.length,
    },
  })
}

// DELETE /api/v1/folders/[id] - Xoa folder cua user hien tai
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const existing = await prisma.linkFolder.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const result = await deleteFolderPreservingRotationForUser(user.id, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, message: 'Folder deleted', ...result })
}
