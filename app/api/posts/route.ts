import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import {
  getManagedContentActor,
  normalizeContent,
  normalizeContentFormat,
  ownsActivePopups,
  postSchema,
  validatePublicationTarget,
} from '@/lib/content-management'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'

const PAGE_SIZES = [6, 10, 20, 25] as const

function pageValue(value: string | null, fallback: number, max = 10000) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.floor(parsed))) : fallback
}

function pageSizeValue(value: string | null) {
  const parsed = Number(value)
  return PAGE_SIZES.includes(parsed as (typeof PAGE_SIZES)[number]) ? parsed : 10
}

// Prisma's include shape is intentionally serialized in one place for dashboard consumers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializePost(post: any) {
  const domain = post.domain?.domain || post.sharedDomain || getSiteHostname()
  return { ...post, publicDomain: domain, publicUrl: `https://${domain}/${post.slug}` }
}

export async function GET(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('query')?.trim() || ''
  const status = req.nextUrl.searchParams.get('status') || 'all'
  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase() || ''
  const page = pageValue(req.nextUrl.searchParams.get('page'), 1)
  const pageSize = pageSizeValue(req.nextUrl.searchParams.get('pageSize'))
  const where: Prisma.ManagedPostWhereInput = {
    userId: actor.id,
    ...(status === 'published' ? { isPublished: true } : status === 'draft' ? { isPublished: false } : {}),
    ...(query || domain ? { AND: [
      ...(query ? [{ OR: [{ title: { contains: query } }, { slug: { contains: query } }, { excerpt: { contains: query } }] }] : []),
      ...(domain ? [domain === getSiteHostname()
        ? { domainId: null, sharedDomain: null }
        : { OR: [{ sharedDomain: domain }, { domain: { domain } }] }] : []),
    ] } : {}),
  }
  const [total, posts] = await prisma.$transaction([
    prisma.managedPost.count({ where }),
    prisma.managedPost.findMany({
      where,
      include: {
        popup: { select: { id: true, name: true, isActive: true } },
        domain: { select: { id: true, domain: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return NextResponse.json({ items: posts.map(serializePost), total, page, pageSize, pageSizes: PAGE_SIZES })
}

export async function POST(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = postSchema.parse(await req.json())
    const popupIds = data.popupIds?.length ? [...new Set(data.popupIds)] : (data.popupId ? [data.popupId] : [])
    if (!(await ownsActivePopups(actor.id, popupIds))) {
      return NextResponse.json({ error: 'Popup không thuộc tài khoản hoặc đang tắt' }, { status: 400 })
    }
    const target = await validatePublicationTarget(actor.id, data.domainId, data.sharedDomain)
    const format = normalizeContentFormat(data.contentFormat)
    const content = normalizeContent(data.content, format, actor.isAdmin)
    const created = await prisma.$transaction(async (tx) => {
      const result = []
      for (let index = 0; index < Math.max(1, popupIds.length); index += 1) {
        const popupId = popupIds[index] || null
        const baseSlug = data.slug
        const candidate = index === 0 ? baseSlug : `${baseSlug}-popup-${index + 1}`
        let slug = candidate
        let suffix = 2
        while (index > 0 && await tx.managedPost.findUnique({ where: { slug }, select: { id: true } })) {
          slug = `${candidate}-${suffix}`
          suffix += 1
        }
        result.push(await tx.managedPost.create({
          data: {
            userId: actor.id,
            popupId,
            domainId: target.domainId,
            sharedDomain: target.sharedDomain,
            title: data.title,
            slug,
            excerpt: data.excerpt || null,
            content,
            contentFormat: format,
            previewImage: data.previewImage || null,
            isPublished: data.isPublished,
          },
          include: { popup: { select: { id: true, name: true, isActive: true } }, domain: { select: { id: true, domain: true } } },
        }))
      }
      return result
    })
    return NextResponse.json({ items: created.map(serializePost), created: created.length }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Đường dẫn bài viết đã tồn tại' }, { status: 409 })
    }
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}
