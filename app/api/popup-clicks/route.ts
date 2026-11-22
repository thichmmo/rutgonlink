import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isBot } from '@/lib/bot-detect'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyPopupClickToken } from '@/lib/popup-click-token'
import { defaultPopupSettings, normalizePopupSettings, popupAppliesToDevice } from '@/lib/popup-settings'

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
    where: { id: postId, isPublished: true, user: { status: 'active', deletedAt: null } },
    select: {
      userId: true,
      popupId: true,
      popup: { select: { id: true, userId: true, settings: true, firstUrl: true, secondUrl: true } },
    },
  })
  if (!post) return new NextResponse(null, { status: 404 })
  // Retain in-flight clicks signed before the owner swapped popups, paused the old popup, or deleted it.
  const currentPopup = post.popup?.userId === post.userId ? post.popup : null
  const matchesCurrent = Boolean(
    currentPopup && (post.popupId === popupId || currentPopup.id === popupId || (post.popupId === undefined && currentPopup.id === undefined)),
  )
  const clickedPopup = matchesCurrent
    ? currentPopup
    : (await prisma.popupTemplate?.findFirst({
      where: { id: popupId, userId: post.userId },
      select: { id: true, userId: true, settings: true, firstUrl: true, secondUrl: true },
    })) ?? null
  const sourcePopup = clickedPopup ?? currentPopup
  const settings = sourcePopup
    ? normalizePopupSettings(sourcePopup.settings, sourcePopup.firstUrl, sourcePopup.secondUrl)
    : defaultPopupSettings()
  // verifyPopupClickToken already proved the server rendered an eligible popup (including Chrome handoff).
  if (!popupAppliesToDevice(settings, ua, { isFacebookSource: true })) return new NextResponse(null, { status: 204 })
  const createdAt = new Date()
  const resolvedPopupId = clickedPopup ? popupId : null
  try {
    // The unique event ID makes browser retransmissions idempotent across server processes.
    await prisma.popupClick.create({ data: { userId: post.userId, postId, popupId: resolvedPopupId, platform, eventId, createdAt } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    }
    // If a concurrent popup delete raced between lookup and insert, still retain the post/user click.
    if (resolvedPopupId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      try {
        await prisma.popupClick.create({ data: { userId: post.userId, postId, popupId: null, platform, eventId, createdAt } })
      } catch (retryError) {
        if (!(retryError instanceof Prisma.PrismaClientKnownRequestError && retryError.code === 'P2002')) throw retryError
      }
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    }
    throw error
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
