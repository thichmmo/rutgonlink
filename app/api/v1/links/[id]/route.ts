import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { syncCategoryLinksToFolderGroup } from '@/lib/folder-rotation-actions'
import { z } from 'zod'
import { buildShortUrl } from '@/lib/site-config'

const LINK_SELECT = {
  id: true,
  shortCode: true,
  originalUrl: true,
  title: true,
  isActive: true,
  expiresAt: true,
  maxClicks: true,
  useFolderRotation: true,
  folderRotationStartDate: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      folderGroupId: true,
      folderGroup: { select: { id: true, name: true } },
    },
  },
  folderAssignments: {
    select: {
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
  _count: { select: { clicks: true } },
} as const

// Schema for PATCH /api/v1/links/:id - update link fields
const updateLinkSchema = z.object({
  title: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  categoryId: z.string().nullable().optional(), // Assign link to category
  useFolderRotation: z.boolean().optional(), // Enable/disable folder rotation
  folderRotationStartDate: z.string().nullable().optional(), // Start date for rotation calculation
})

/** GET /api/v1/links/:id */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const link = await prisma.link.findFirst({
    where: { id, userId: user.id },
    select: LINK_SELECT,
  })

  if (!link) {
    return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      ...link,
      shortUrl: buildShortUrl(link.shortCode),
      clicks: link._count.clicks,
      _count: undefined,
    },
  })
}

/** PATCH /api/v1/links/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const existing = await prisma.link.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 })
  }

  const parsed = updateLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message, details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data
  const updateData: Record<string, unknown> = {}
  const nextCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId
  const shouldSyncCategoryFolders = !!nextCategoryId && data.categoryId !== undefined && nextCategoryId !== existing.categoryId
  if (data.title !== undefined) updateData.title = data.title || null
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
  if (data.maxClicks !== undefined) updateData.maxClicks = data.maxClicks
  // Update category assignment
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
  // Update folder rotation settings
  if (data.useFolderRotation !== undefined) updateData.useFolderRotation = data.useFolderRotation
  if (data.folderRotationStartDate !== undefined) {
    updateData.folderRotationStartDate = data.folderRotationStartDate ? new Date(data.folderRotationStartDate) : null
  }

  let updated = await prisma.link.update({
    where: { id },
    data: updateData,
    select: LINK_SELECT,
  })

  if (shouldSyncCategoryFolders && nextCategoryId) {
    await syncCategoryLinksToFolderGroup(user.id, nextCategoryId, [id])
    const synced = await prisma.link.findFirst({
      where: { id, userId: user.id },
      select: LINK_SELECT,
    })
    if (synced) updated = synced
  }

  return NextResponse.json({
    data: {
      ...updated,
      shortUrl: buildShortUrl(updated.shortCode),
      clicks: updated._count.clicks,
      _count: undefined,
    },
  })
}

/** DELETE /api/v1/links/:id */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const existing = await prisma.link.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
  }

  await prisma.link.delete({ where: { id } })
  return NextResponse.json({ ok: true, message: 'Link đã được xoá' })
}
