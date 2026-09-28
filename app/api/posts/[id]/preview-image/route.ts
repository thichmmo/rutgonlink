import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { renderPostPreviewImage } from '@/lib/post-preview-image'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }
const cache = new Map<string, { until: number; image: Promise<Buffer> }>()

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params
  const post = await prisma.managedPost.findFirst({
    where: { id, isPublished: true, user: { status: 'active', deletedAt: null } },
    select: { previewImage: true, isFakeVideo: true, updatedAt: true },
  })
  if (!post?.previewImage) return new Response('Not found', { status: 404 })
  const key = createHash('sha256').update(`${post.updatedAt.toISOString()}|${post.isFakeVideo}|${post.previewImage}`).digest('hex')
  try {
    // Coalesce simultaneous crawler requests and bound decoded-image cache memory.
    let entry = cache.get(key)
    if (!entry || entry.until <= Date.now()) {
      if (cache.size >= 32) cache.delete(cache.keys().next().value!)
      entry = { until: Date.now() + 300_000, image: renderPostPreviewImage(post.previewImage, post.isFakeVideo) }
      cache.set(key, entry)
    }
    const body = await entry.image
    return new Response(new Uint8Array(body), { headers: {
      'Content-Type': 'image/jpeg', 'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    cache.delete(key)
    return new Response('Preview image unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
