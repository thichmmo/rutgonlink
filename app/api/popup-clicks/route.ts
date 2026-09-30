import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isBot } from '@/lib/bot-detect'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyPopupClickToken } from '@/lib/popup-click-token'
import { normalizePopupSettings, popupAppliesToDevice } from '@/lib/popup-settings'

const clickSchema = z.object({
  postId: z.string().min(1).max(191), popupId: z.string().min(1).max(191),
  eventId: z.string().min(16).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  platform: z.enum(['SHOPEE', 'TIKTOK']), token: z.string().min(1).max(1500),
})

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  if (isBot(ua)) return new NextResponse(null, { status: 204 })
  if (Number(req.headers.get('content-length') || 0) > 4096) return new NextResponse(null, { status: 413 })
  const raw = await req.text()
  if (raw.length > 4096) return new NextResponse(null, { status: 413 })
  let parsed
  try { parsed = clickSchema.safeParse(JSON.parse(raw)) } catch { return new NextResponse(null, { status: 400 }) }
  if (!parsed.success) return new NextResponse(null, { status: 400 })
  const { postId, popupId, platform, eventId, token } = parsed.data
  const host = (req.headers.get('host') || req.nextUrl.host).toLowerCase()
  const origin = req.headers.get('origin')
  if (origin) {
    try { if (new URL(origin).host.toLowerCase() !== host) return new NextResponse(null, { status: 403 }) } catch { return new NextResponse(null, { status: 403 }) }
  }
  if (!verifyPopupClickToken(token, postId, popupId, host)) return new NextResponse(null, { status: 403 })
  if (!checkRateLimit(`popup-click:${getClientIp(req)}:${postId}`, 120, 60000)) return new NextResponse(null, { status: 429 })
  const post = await prisma.managedPost.findFirst({
    where: { id: postId, popupId, isPublished: true, user: { status: 'active', deletedAt: null }, popup: { isActive: true } },
    select: { userId: true, popup: { select: { userId: true, settings: true, firstUrl: true, secondUrl: true } } },
  })
  if (!post?.popup || post.popup.userId !== post.userId) return new NextResponse(null, { status: 404 })
  const settings = normalizePopupSettings(post.popup.settings, post.popup.firstUrl, post.popup.secondUrl)
  if (!popupAppliesToDevice(settings, ua)) return new NextResponse(null, { status: 204 })
  try {
    // The unique event ID makes browser retransmissions idempotent across server processes.
    await prisma.popupClick.create({ data: { userId: post.userId, postId, popupId, platform, eventId, createdAt: new Date() } })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
