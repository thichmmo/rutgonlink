import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { invalidateLinkCache } from '@/lib/link-cache'
import { prisma } from '@/lib/prisma'

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
  const body = await req.json().catch(() => null)
  if (typeof body?.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })
  }

  const category = await prisma.category.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!category) return NextResponse.json({ error: 'Khong tim thay danh muc' }, { status: 404 })

  const links = await prisma.link.findMany({
    where: { userId, categoryId: id },
    select: { id: true, shortCode: true },
  })

  const updated = await prisma.link.updateMany({
    where: { userId, categoryId: id, isActive: { not: body.isActive } },
    data: { isActive: body.isActive },
  })

  // Bulk status changes need cache invalidation for every short code in the category.
  links.forEach((link) => invalidateLinkCache(link.shortCode))

  return NextResponse.json({
    success: true,
    isActive: body.isActive,
    updated: updated.count,
    totalLinks: links.length,
    activeLinks: body.isActive ? links.length : 0,
  })
}
