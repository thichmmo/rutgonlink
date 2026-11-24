import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isBot } from '@/lib/bot-detect'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyPopupClickToken } from '@/lib/popup-click-token'
import { defaultPopupSettings, normalizePopupSettings, popupAppliesToDevice } from '@/lib/popup-settings'

const VISITOR_COOKIE_NAME = 'rgl_vid'
const VISITOR_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/

const clickSchema = z.object({
  postId: z.string().min(1).max(191), popupId: z.string().min(1).max(191),
  eventId: z.string().min(16).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  visitorId: z.string().min(16).max(80).regex(VISITOR_ID_PATTERN).optional(),
  platform: z.enum(['SHOPEE', 'TIKTOK']), token: z.string().min(1).max(1500),
})

function extractVisitorCookie(req: NextRequest) {
  const fromCookies = req.cookies?.get?.(VISITOR_COOKIE_NAME)?.value || ''
  if (VISITOR_ID_PATTERN.test(fromCookies)) return fromCookies
  const rawHeader = req.headers.get('cookie') || ''
  for (const part of rawHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${VISITOR_COOKIE_NAME}=`)) {
      const candidate = trimmed.slice(VISITOR_COOKIE_NAME.length + 1)
      if (VISITOR_ID_PATTERN.test(candidate)) return candidate
    }
  }
  return ''
}

function isLoopbackOrUnknownIp(ip: string) {
  const normalized = ip.trim().toLowerCase()
  return !normalized || normalized === 'unknown' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1'
}

function buildDeduplicatedEventId(input: {
  rawEventId: string
  visitorId?: string
  clientIp: string
  userAgent: string
  userId: string
  popupScope: string
  popupVersion: number
  platform: string
  createdAt: Date
}) {
  // Deduplicate repeat clicks from the same device across multiple posts sharing the same popup/affiliate link
  // within the Vietnam day (UTC+7), matching Shopee Affiliate's unique-visitor click filtering while preserving
  // fresh counts whenever the owner swaps or edits the popup URL.
  if (input.visitorId) {
    const vnDay = Math.floor((input.createdAt.getTime() + 7 * 3600_000) / 86_400_000)
    const digest = createHash('sha256')
      .update(`${input.userId}|${input.popupScope}|${input.popupVersion}|${input.platform}|vid:${input.visitorId}|d:${vnDay}`)
      .digest('hex')
      .slice(0, 48)
    return `v1_${digest}`
  }
  // When storage/cookies are blocked on a real mobile network, collapse rapid 30-minute bursts per IP+UA+popup.
  if (!isLoopbackOrUnknownIp(input.clientIp)) {
    const slot30m = Math.floor(input.createdAt.getTime() / (30 * 60_000))
    const digest = createHash('sha256')
      .update(`${input.userId}|${input.popupScope}|${input.popupVersion}|${input.platform}|ipua:${input.clientIp}|${input.userAgent}|s:${slot30m}`)
      .digest('hex')
      .slice(0, 48)
    return `ip1_${digest}`
  }
  return input.rawEventId
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  if (isBot(ua)) return new NextResponse(null, { status: 204 })
  if (Number(req.headers.get('content-length') || 0) > 4096) return new NextResponse(null, { status: 413 })
  const raw = await req.text()
  if (raw.length > 4096) return new NextResponse(null, { status: 413 })
  let parsed
  try { parsed = clickSchema.safeParse(JSON.parse(raw)) } catch { return new NextResponse(null, { status: 400 }) }
  if (!parsed.success) return new NextResponse(null, { status: 400 })
  const { postId, popupId, platform, eventId, visitorId, token } = parsed.data
  const host = (req.headers.get('host') || req.nextUrl.host).toLowerCase()
  const origin = req.headers.get('origin')
  // WebKit (iOS Safari & FBIOS WKWebView) sends "Origin: null" on same-origin sendBeacon/fetch when
  // Referrer-Policy: no-referrer is active; verifyPopupClickToken still enforces host/post/popup HMAC.
  if (origin && origin !== 'null') {
    try { if (new URL(origin).host.toLowerCase() !== host) return new NextResponse(null, { status: 403 }) } catch { return new NextResponse(null, { status: 403 }) }
  }
  const clientIp = getClientIp(req)
  if (!verifyPopupClickToken(token, postId, popupId, host)) return new NextResponse(null, { status: 403 })
  if (!checkRateLimit(`popup-click:${clientIp}:${postId}`, 120, 60000)) return new NextResponse(null, { status: 429 })
  const post = await prisma.managedPost.findFirst({
    where: { id: postId, isPublished: true, user: { status: 'active', deletedAt: null } },
    select: {
      userId: true,
      popupId: true,
      popup: { select: { id: true, userId: true, settings: true, firstUrl: true, secondUrl: true, updatedAt: true } },
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
      select: { id: true, userId: true, settings: true, firstUrl: true, secondUrl: true, updatedAt: true },
    })) ?? null
  const sourcePopup = clickedPopup ?? currentPopup
  const settings = sourcePopup
    ? normalizePopupSettings(sourcePopup.settings, sourcePopup.firstUrl, sourcePopup.secondUrl)
    : defaultPopupSettings()
  // verifyPopupClickToken already proved the server rendered an eligible popup (including Chrome handoff).
  if (!popupAppliesToDevice(settings, ua, { isFacebookSource: true })) return new NextResponse(null, { status: 204 })
  const createdAt = new Date()
  const resolvedPopupId = clickedPopup ? popupId : null
  const popupScope = resolvedPopupId ?? `deleted:${popupId}:${postId}`
  const popupVersion = sourcePopup?.updatedAt instanceof Date ? sourcePopup.updatedAt.getTime() : 0
  const cookieVisitorId = extractVisitorCookie(req)
  const resolvedVisitorId = cookieVisitorId || visitorId || (!isLoopbackOrUnknownIp(clientIp) ? randomUUID() : '')
  const effectiveEventId = buildDeduplicatedEventId({
    rawEventId: eventId,
    visitorId: resolvedVisitorId || undefined,
    clientIp,
    userAgent: ua,
    userId: post.userId,
    popupScope,
    popupVersion,
    platform,
    createdAt,
  })
  const responseHeaders: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (resolvedVisitorId && !cookieVisitorId) {
    responseHeaders['Set-Cookie'] = `${VISITOR_COOKIE_NAME}=${resolvedVisitorId}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`
  }
  try {
    // The unique event ID makes browser retransmissions and same-visitor multi-post repeats idempotent across workers.
    await prisma.popupClick.create({ data: { userId: post.userId, postId, popupId: resolvedPopupId, platform, eventId: effectiveEventId, createdAt } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new NextResponse(null, { status: 204, headers: responseHeaders })
    }
    // If a concurrent popup delete raced between lookup and insert, still retain the post/user click.
    if (resolvedPopupId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      try {
        await prisma.popupClick.create({ data: { userId: post.userId, postId, popupId: null, platform, eventId: effectiveEventId, createdAt } })
      } catch (retryError) {
        if (!(retryError instanceof Prisma.PrismaClientKnownRequestError && retryError.code === 'P2002')) throw retryError
      }
      return new NextResponse(null, { status: 204, headers: responseHeaders })
    }
    throw error
  }
  return new NextResponse(null, { status: 204, headers: responseHeaders })
}
