import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import {
  getManagedContentActor,
  normalizeContent,
  normalizeContentFormat,
  ownsPopupRecord,
  postSchema,
  validatePublicationTarget,
} from '@/lib/content-management'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'

type Context = { params: Promise<{ id: string }> }

async function getPost(id: string, userId: string) {
  return prisma.managedPost.findFirst({
    where: { id, userId },
    include: { popup: { select: { id: true, name: true, isActive: true } }, domain: { select: { id: true, domain: true } } },
  })
}

// Prisma's include shape is intentionally serialized in one place for dashboard consumers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializePost(post: any) {
  const domain = post.domain?.domain || post.sharedDomain || getSiteHostname()
  return { ...post, publicDomain: domain, publicUrl: `https://${domain}/${post.slug}` }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const data = postSchema.parse(await req.json())
    if (!(await ownsPopupRecord(actor.id, data.popupId))) {
      return NextResponse.json({ error: 'Popup không thuộc tài khoản này' }, { status: 400 })
    }
    const target = await validatePublicationTarget(actor.id, data.domainId, data.sharedDomain)
    const format = normalizeContentFormat(data.contentFormat)
    const content = normalizeContent(data.content, format, actor.isAdmin)
    const updated = await prisma.managedPost.updateMany({
      where: { id, userId: actor.id },
      data: {
        title: data.title,
        slug: data.slug,
        popupId: data.popupId || null,
        domainId: target.domainId,
        sharedDomain: target.sharedDomain,
        excerpt: data.excerpt || null,
        content,
        contentFormat: format,
        previewImage: data.previewImage || null,
        isPublished: data.isPublished,
      },
    })
    if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
    return NextResponse.json(serializePost((await getPost(id, actor.id))!))
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Đường dẫn bài viết đã tồn tại' }, { status: 409 })
    }
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const deleted = await prisma.managedPost.deleteMany({ where: { id, userId: actor.id } })
  if (!deleted.count) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
