import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { deleteFolderPreservingRotationForUser } from '@/lib/folder-rotation-actions'
import { z } from 'zod'

// PATCH /api/folders/[id] - Update folder
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  urls: z.string().refine(
    (val) => {
      const urls = val.split('\n').map(u => u.trim()).filter(Boolean)
      return urls.length > 0 && urls.every(u => {
        try { new URL(u); return true } catch { return false }
      })
    },
    'Folder phải có ít nhất 1 URL hợp lệ'
  ).optional(),
  folderGroupId: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: folderId } = await context.params

    const folder = await prisma.linkFolder.findUnique({
      where: { id: folderId },
      select: { userId: true },
    })

    if (!folder) {
      return NextResponse.json({ error: 'Folder không tồn tại' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user || folder.userId !== user.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const body = await req.json()
    const validation = updateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, urls, folderGroupId } = validation.data

    const updated = await prisma.linkFolder.update({
      where: { id: folderId },
      data: {
        ...(name !== undefined && { name }),
        ...(urls !== undefined && { urls }),
        ...(folderGroupId !== undefined && { folderGroupId: folderGroupId || null }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/folders/[id]]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}

// DELETE /api/folders/[id] - Delete folder
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: folderId } = await context.params

    const folder = await prisma.linkFolder.findUnique({
      where: { id: folderId },
      select: { userId: true },
    })

    if (!folder) {
      return NextResponse.json({ error: 'Folder không tồn tại' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user || folder.userId !== user.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
    }

    const result = await deleteFolderPreservingRotationForUser(user.id, folderId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[DELETE /api/folders/[id]]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
