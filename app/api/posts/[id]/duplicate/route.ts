import { NextResponse } from 'next/server'
import { getManagedContentActor } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const source = await prisma.managedPost.findFirst({ where: { id, userId: actor.id } })
  if (!source) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
  let slug = `${source.slug}-copy`
  let suffix = 2
  while (await prisma.managedPost.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${source.slug}-copy-${suffix}`
    suffix += 1
  }
  const copy = await prisma.managedPost.create({
    data: {
      userId: actor.id,
      popupId: source.popupId,
      domainId: source.domainId,
      sharedDomain: source.sharedDomain,
      title: `${source.title} - bản sao`,
      slug,
      excerpt: source.excerpt,
      content: source.content,
      contentFormat: source.contentFormat,
      previewImage: source.previewImage,
      isPublished: false,
    },
    include: { popup: { select: { id: true, name: true, isActive: true } }, domain: { select: { id: true, domain: true } } },
  })
  return NextResponse.json(copy, { status: 201 })
}
