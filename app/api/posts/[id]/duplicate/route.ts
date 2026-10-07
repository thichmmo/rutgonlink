import { NextResponse } from 'next/server'
import { getManagedContentActor } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getSiteHostname } from '@/lib/site-config'
import { getPublicPostPath, isNumericPostSlug } from '@/lib/public-post-link'
import { allocateNumericPostSlug, NumericPostLinkExhaustedError, retryNumericPostCreation } from '@/lib/numeric-post-link-server'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const source = await prisma.managedPost.findFirst({ where: { id, userId: actor.id } })
  if (!source) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
  const numericLink = isNumericPostSlug(source.slug)
  const createTransaction = () => prisma.$transaction(async tx => {
    let slug = numericLink ? await allocateNumericPostSlug(tx.managedPost) : `${source.slug}-copy`
    let suffix = 2
    while (!numericLink && await tx.managedPost.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${source.slug}-copy-${suffix}`
      suffix += 1
    }
    return tx.managedPost.create({
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
        isFakeVideo: source.isFakeVideo,
        isPublished: false,
        // A legacy NULL means disabled, not "inherit the current account default".
        telegramSettings: source.telegramSettings === null ? Prisma.DbNull : source.telegramSettings as Prisma.InputJsonValue,
      },
      include: { popup: { select: { id: true, name: true, isActive: true } }, domain: { select: { id: true, domain: true } } },
    })
  })
  try {
    const copy = numericLink ? await retryNumericPostCreation(createTransaction) : await createTransaction()
    const domain = copy.domain?.domain || copy.sharedDomain || getSiteHostname()
    return NextResponse.json({ ...copy, publicDomain: domain, publicUrl: `https://${domain}${getPublicPostPath(copy.slug)}` }, { status: 201 })
  } catch (error) {
    if (error instanceof NumericPostLinkExhaustedError) return NextResponse.json({ error: error.message }, { status: 409 })
    throw error
  }
}
