import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { invalidateLinkCache } from '@/lib/link-cache'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (typeof body?.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })
  }

  const category = await prisma.category.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true },
  })
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  const links = await prisma.link.findMany({
    where: { userId: auth.user.id, categoryId: id },
    select: { id: true, shortCode: true },
  })

  const updated = await prisma.link.updateMany({
    where: { userId: auth.user.id, categoryId: id, isActive: { not: body.isActive } },
    data: { isActive: body.isActive },
  })

  // Keep redirect cache in sync after a category-level bulk status change.
  links.forEach((link) => invalidateLinkCache(link.shortCode))

  return NextResponse.json({
    success: true,
    isActive: body.isActive,
    updated: updated.count,
    totalLinks: links.length,
    activeLinks: body.isActive ? links.length : 0,
  })
}
