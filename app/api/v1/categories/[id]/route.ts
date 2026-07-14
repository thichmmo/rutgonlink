import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { invalidateLinkCache } from '@/lib/link-cache'

// DELETE /api/v1/categories/[id] - Delete a category owned by the API user.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const category = await prisma.category.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const deleteLinks = body?.deleteLinks === true
  const links = await prisma.link.findMany({
    where: { categoryId: id, userId: user.id },
    select: { id: true, shortCode: true },
  })

  await prisma.$transaction(async (tx) => {
    if (deleteLinks) {
      // Explicit destructive option: delete all category links before deleting the category.
      await tx.link.deleteMany({ where: { categoryId: id, userId: user.id } })
    } else {
      await tx.link.updateMany({
        where: { categoryId: id, userId: user.id },
        data: { categoryId: null },
      })
    }
    await tx.category.delete({ where: { id } })
  })

  links.forEach((link) => invalidateLinkCache(link.shortCode))

  return NextResponse.json({
    success: true,
    message: 'Category deleted',
    deletedLinks: deleteLinks ? links.length : 0,
    detachedLinks: deleteLinks ? 0 : links.length,
  })
}
