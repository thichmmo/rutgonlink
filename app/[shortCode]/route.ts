import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UAParser } from 'ua-parser-js'
import { createUnlockToken } from '@/lib/unlock-token'
import { getPlanLimits, isPlanActive } from '@/lib/plan-limits'
import { triggerFbScrape } from '@/lib/runtime-config'
import { getActiveFolderUrls } from '@/lib/folder-rotation'
import { getSiteUrl } from '@/lib/site-config'

interface LinkResult {
  id: string
  userId: string
  shortCode: string
  originalUrl: string
  isActive: boolean
  ogEnabled: boolean
  ogAutoReset: boolean
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  password: string | null
  expiresAt: Date | null
  maxClicks: number | null
  deepLinkIos: string | null
  deepLinkAndroid: string | null
  lastFbDebug: Date | null
  useFolderRotation: boolean
  folderRotationStartDate: Date | null
  category: { id: string; folderGroupId: string | null } | null
  folderAssignments: { id: string; order: number; folder: { id: string; urls: string; folderGroupId: string | null } }[]
  deviceRules: { id: string; linkId: string; deviceType: string; redirectUrl: string }[]
  countryRules: { id: string; linkId: string; countryCode: string; redirectUrl: string }[]
  languageRules: { id: string; linkId: string; languageCode: string; redirectUrl: string }[]
  _count: { clicks: number }
  user: { plan: string; planExpiresAt: Date | null }
}

// In-memory click count cache to avoid DB hit on every redirect: userId → { count, cachedAt }
const monthlyClickCache = new Map<string, { count: number; cachedAt: number }>()
const CLICK_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

async function getMonthlyClicks(userId: string): Promise<number> {
  const cached = monthlyClickCache.get(userId)
  if (cached && Date.now() - cached.cachedAt < CLICK_CACHE_TTL) return cached.count
  const VN_OFFSET = 7 * 60 * 60 * 1000
  const nowVN = new Date(Date.now() + VN_OFFSET)
  const firstOfMonthVN = new Date(nowVN)
  firstOfMonthVN.setUTCDate(1)
  firstOfMonthVN.setUTCHours(0, 0, 0, 0)
  const firstOfMonth = new Date(firstOfMonthVN.getTime() - VN_OFFSET)
  const count = await prisma.click.count({
    where: { link: { userId }, createdAt: { gte: firstOfMonth } },
  })
  monthlyClickCache.set(userId, { count, cachedAt: Date.now() })
  return count
}

const KNOWN_PATHS = ['dashboard', 'login', 'register', 'api', '_next', 'favicon.ico', 'public', 'bio', 'p', 'share']

async function getCachedLink(shortCode: string, hostname: string): Promise<LinkResult | null> {
  const domainRecord = await prisma.domain.findUnique({ where: { domain: hostname } })
  const domainId = domainRecord ? domainRecord.id : null
  const result = await prisma.link.findFirst({
    where: { shortCode, domainId },
    include: {
      category: { select: { id: true, folderGroupId: true } },
      deviceRules: true,
      countryRules: true,
      languageRules: true,
      folderAssignments: {
        select: { id: true, order: true, folder: { select: { id: true, urls: true, folderGroupId: true } } },
        orderBy: { order: 'asc' }
      },
      _count: { select: { clicks: true } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: { select: { plan: true, planExpiresAt: true } } as any,
    },
  })
  return result as unknown as LinkResult | null
}

// Batch click writer: gom click trong 2 giây rồi INSERT một lần
type ClickData = {
  linkId: string; ip: string | null; country: string | null; city: string | null
  device: string; deviceModel: string | null; browser: string; os: string; osVersion: string | null
  referer: string | null; language: string | null
}
const clickBuffer: ClickData[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    if (clickBuffer.length === 0) return
    const batch = clickBuffer.splice(0, clickBuffer.length)
    prisma.click.createMany({ data: batch }).catch(console.error)
  }, 2000)
}

function trackClick(data: ClickData) {
  clickBuffer.push(data)
  scheduleFlush()
}

// Bot UA dùng để quyết định có render OG page không (chỉ social bots)
const SOCIAL_BOT_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Zalobot|Pinterest|vkShare|Discordbot|Googlebot/i

// Bot UA đầy đủ dùng để lọc click — bao gồm mọi loại bot/crawler/tool
const BOT_UA_REGEX = /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Zalobot|Pinterest|vkShare|Discordbot|Googlebot|bingbot|duckduckbot|Baiduspider|YandexBot|Sogou|Exabot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|DotBot|rogerbot|curl|wget|python-requests|python-urllib|libwww|axios|java\/|okhttp|Go-http-client|HeadlessChrome|PhantomJS|Selenium|Puppeteer/i

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Fake video player UI: nền đen, nút play đỏ ở giữa, thanh tiến trình + các icon dưới đáy.
// Toàn bộ player bọc trong <a href=...> → click đâu cũng redirect.
const FAKE_VIDEO_CSS = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden;font-family:Roboto,Arial,sans-serif}.vp-link{display:block;width:100%;height:100%;text-decoration:none;color:#fff}.vp-root{position:relative;width:100vw;height:100vh;background:#000}.vp-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;background:#ff0000;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 16px rgba(0,0,0,.5)}.vp-play::before{content:"";display:block;width:0;height:0;border-left:22px solid #fff;border-top:13px solid transparent;border-bottom:13px solid transparent;margin-left:5px}.vp-controls{position:absolute;bottom:0;left:0;right:0;padding:0 14px 10px;color:#fff}.vp-progress{height:4px;background:rgba(255,255,255,.25);margin-bottom:8px;position:relative;border-radius:2px;overflow:hidden}.vp-progress-fill{position:absolute;top:0;left:0;height:100%;width:0%;background:#ff0000}.vp-row{display:flex;align-items:center;gap:16px;font-size:13px;line-height:1}.vp-row .vp-spacer{flex:1}.vp-icon{width:24px;height:24px;display:inline-flex;opacity:.95}.vp-icon svg{width:100%;height:100%}.vp-time{font-variant-numeric:tabular-nums;letter-spacing:.5px;white-space:nowrap}`

function buildFakeVideoBody(safeUrl: string): string {
  return `<a class="vp-link" href="${safeUrl}"><div class="vp-root"><div class="vp-play"></div><div class="vp-controls"><div class="vp-progress"><div class="vp-progress-fill"></div></div><div class="vp-row"><span class="vp-icon"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span><span class="vp-icon"><svg viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg></span><span class="vp-time">0:00 / 4:56</span><span class="vp-spacer"></span><span class="vp-icon"><svg viewBox="0 0 24 24" fill="#fff"><path d="M19.4 13a7 7 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.7A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.4L9.1 5.1a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7 7 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.7a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.7a7.3 7.3 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg></span><span class="vp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="1"/></svg></span><span class="vp-icon"><svg viewBox="0 0 24 24" fill="#fff"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></span><span class="vp-icon"><svg viewBox="0 0 24 24" fill="#fff"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg></span></div></div></div></a>`
}

function buildFakeVideoPage(redirectUrl: string): string {
  const safeUrl = escapeHtml(redirectUrl)
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Video</title><style>${FAKE_VIDEO_CSS}</style></head><body>${buildFakeVideoBody(safeUrl)}</body></html>`
}

function buildOgPage(params: {
  redirectUrl: string
  deepLinkIos?: string | null
  deepLinkAndroid?: string | null
  slotUrl?: string | null
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  shortUrl: string
  linkId: string
  origin: string
  isSocialBot: boolean
  ua?: string
}): string {
  const { redirectUrl, deepLinkIos, deepLinkAndroid, ogTitle, ogDescription, ogImage, shortUrl, linkId, ua = '' } = params
  void params.slotUrl; void params.origin; void params.isSocialBot
  // Base64 image: serve qua main domain vì custom domain có thể không proxy /api/*
    const mainOriginForImage = getSiteUrl()
  const resolvedOgImage = ogImage
    ? ogImage.startsWith('data:')
      ? `${mainOriginForImage}/api/og-image/${linkId}`
      : ogImage
    : null
  const title = escapeHtml(ogTitle || 'Chuyển hướng...')
  const desc = escapeHtml(ogDescription || '')
  const safeRedirect = escapeHtml(redirectUrl)

  // Lấy deep link phù hợp với thiết bị hiện tại
  const isIos = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)

  // Auto-detect App Link (Shopee, Lazada, ...) nếu không điền deep link riêng
  // LƯU Ý: chỉ dùng auto-detect cho redirect script (JS), KHÔNG đưa vào al:* meta tags
  // vì Facebook cache al:* tại thời điểm crawl → nếu có URL rotation sẽ bị fix 1 URL, không random
  const APP_LINK_DOMAINS = /shopee\.(vn|sg|ph|my|tw|co\.id|com\.br|com\.mx|com\.co|com\.cl|in)|s\.shopee\.|lazada\.(vn|sg|ph|my|co\.id|com\.br)|shope\.ee|tiki\.vn|sendo\.vn|tiktok\.com/i
  const effectiveDeepLinkAndroid = deepLinkAndroid || (APP_LINK_DOMAINS.test(redirectUrl) ? redirectUrl : null)
  const effectiveDeepLinkIos = deepLinkIos || (APP_LINK_DOMAINS.test(redirectUrl) ? redirectUrl : null)
  // al:* meta tags: CHỈ dùng explicit deep link do user nhập (custom scheme như shopee://)
  // KHÔNG auto-detect URL https:// vào al:* vì FB yêu cầu app scheme, https không hợp lệ (error 1611016)
  const alDeepLinkAndroid = deepLinkAndroid || null
  const alDeepLinkIos = deepLinkIos || null

  // Script redirect: nếu có deep link thì thử mở app trước, fallback web
  const effectiveDeepLink = isIos ? effectiveDeepLinkIos : isAndroid ? effectiveDeepLinkAndroid : null
  const safeEffectiveDeep = effectiveDeepLink ? escapeHtml(effectiveDeepLink) : null
  // Fake video UI: không auto-redirect cho người dùng — user click vào fake player mới redirect.
  // Với social bot: trả về rỗng (bot chỉ đọc OG meta tags, không cần JS/refresh).
  const redirectScript = ''

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${escapeHtml(shortUrl)}" />
  <meta property="og:type" content="website" />
  ${resolvedOgImage ? `<meta property="og:image" content="${escapeHtml(resolvedOgImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />` : ''}
  <meta name="twitter:card" content="${resolvedOgImage ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  ${resolvedOgImage ? `<meta name="twitter:image" content="${escapeHtml(resolvedOgImage)}" />` : ''}
  <meta itemprop="name" content="${title}" />
  <meta itemprop="description" content="${desc}" />
  ${resolvedOgImage ? `<meta itemprop="image" content="${escapeHtml(resolvedOgImage)}" />` : ''}
  ${alDeepLinkAndroid ? `<meta property="al:android:url" content="${escapeHtml(alDeepLinkAndroid)}" />` : ''}
  ${alDeepLinkIos ? `<meta property="al:ios:url" content="${escapeHtml(alDeepLinkIos)}" />` : ''}
  ${redirectScript}
  <style>${FAKE_VIDEO_CSS}</style>
</head>
<body>${buildFakeVideoBody(safeEffectiveDeep || safeRedirect)}</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params

  if (KNOWN_PATHS.includes(shortCode)) {
    return NextResponse.next()
  }

  const host = req.headers.get('host') || ''
  const hostname = host.split(':')[0]

  const link = await getCachedLink(shortCode, hostname)

  const mainOrigin = getSiteUrl()

  if (!link || !link.isActive) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:sans-serif}h1{font-size:2rem;font-weight:600;color:#111;letter-spacing:.05em}span{color:#999}</style></head><body><h1>404 <span>NOT FOUND</span></h1></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.redirect(`${mainOrigin}/?error=expired`)
  }

  // Click limit (pre-check) — chỉ block ngay nếu KHÔNG có ogAutoReset
  // Trường hợp có ogAutoReset: cho qua, reset sau khi đếm click xong (phía dưới)
  if (link.maxClicks !== null && !link.ogAutoReset) {
    const freshClickCount = await prisma.click.count({ where: { linkId: link.id } })
    if (freshClickCount >= link.maxClicks) {
      await prisma.link.update({ where: { id: link.id }, data: { isActive: false } })
      return new NextResponse(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link đã hết lượt</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:sans-serif;text-align:center}.box{padding:2rem}.title{font-size:1.5rem;font-weight:600;color:#111;margin-bottom:.5rem}.sub{color:#999;font-size:.9rem}</style></head><body><div class="box"><div class="title">Link đã hết lượt truy cập</div><div class="sub">Link này đã đạt giới hạn số lần click cho phép.</div></div></body></html>`,
        { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }
  }

  // Monthly click quota (Pro/Ultra plans only — free is unlimited)
  if (link.user && link.user.plan !== 'free') {
    const effectivePlan = isPlanActive(link.user.plan, link.user.planExpiresAt) ? link.user.plan : 'free'
    const limits = getPlanLimits(effectivePlan)
    if (limits.maxClicksPerMonth !== null) {
      const monthlyClicks = await getMonthlyClicks(link.userId)
      if (monthlyClicks >= limits.maxClicksPerMonth) {
        return new NextResponse(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Đã hết quota</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:sans-serif;text-align:center}.box{padding:2rem}.title{font-size:1.5rem;font-weight:600;color:#111;margin-bottom:.5rem}.sub{color:#999;font-size:.9rem}</style></head><body><div class="box"><div class="title">Link tạm thời không khả dụng</div><div class="sub">Số lượt truy cập trong tháng đã đạt giới hạn.</div></div></body></html>`,
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }
  }

  // Password gate
  if (link.password) {
    const cookieVal = req.cookies.get(`link_pw_${shortCode}`)?.value
    if (cookieVal !== createUnlockToken(shortCode)) {
      return NextResponse.redirect(`${mainOrigin}/p/${shortCode}`)
    }
  }

  const ua = req.headers.get('user-agent') || ''
  const parser = new UAParser(ua)
  const rawDevice = parser.getDevice()
  const deviceType = rawDevice.type || 'desktop'
  const deviceVendor = rawDevice.vendor || ''
  const deviceModelRaw = rawDevice.model || ''
  const deviceModel = (deviceVendor || deviceModelRaw)
    ? `${deviceVendor} ${deviceModelRaw}`.trim()
    : null
  const browser = parser.getBrowser().name || 'Unknown'
  const rawOS = parser.getOS()
  const os = rawOS.name || 'Unknown'
  const osVersion = rawOS.version || null

  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || ''
  const city = req.headers.get('x-vercel-ip-city') || ''
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    ''
  const referer = req.headers.get('referer') || ''
  const language = req.headers.get('accept-language')?.split(',')[0]?.trim() || ''

  // URL rotation
  let urlList: string[]
  if (link.useFolderRotation && link.folderAssignments.length > 0 && link.folderRotationStartDate) {
    // Per-folder-group rotation: filter folders by category's folder group
    let foldersToUse = link.folderAssignments

    if (link.category?.folderGroupId) {
      // Filter to only folders in the category's folder group
      foldersToUse = link.folderAssignments.filter(a => a.folder.folderGroupId === link.category?.folderGroupId)
    }

    if (foldersToUse.length > 0) {
      const folders = foldersToUse.map(a => ({ order: a.order, urls: a.folder.urls }))
      urlList = getActiveFolderUrls(folders, link.folderRotationStartDate)
    } else {
      // No folders in the category's folder group, fallback to originalUrl
      urlList = link.originalUrl.split('\n').map((u: string) => u.trim()).filter(Boolean)
    }

    // Fallback to originalUrl if active folder has no URLs
    if (urlList.length === 0) {
      urlList = link.originalUrl.split('\n').map((u: string) => u.trim()).filter(Boolean)
    }
  } else {
    // Use original URL list (default behavior)
    urlList = link.originalUrl.split('\n').map((u: string) => u.trim()).filter(Boolean)
  }

  let redirectUrl = urlList.length > 1
    ? urlList[Math.floor(Math.random() * urlList.length)]
    : urlList[0]

  const isSocialBot = SOCIAL_BOT_REGEX.test(ua)
  const isBot = BOT_UA_REGEX.test(ua) || !ua.trim()

  // Random URL cho Facebook bot: mỗi lần FB crawl/scrape lại sẽ nhận 1 URL ngẫu nhiên trong danh sách
  const SLOT_MS = 30 * 60 * 1000
  const slotUrl = urlList.length > 1 ? urlList[Math.floor(Math.random() * urlList.length)] : urlList[0]

  // Nếu là social bot crawl: dùng slotUrl làm redirectUrl để inject al:* meta
  if (isSocialBot && urlList.length > 1) {
    redirectUrl = slotUrl
    // Trigger FB re-scrape async nếu đã qua slot mới (lastFbDebug > 30p trước)
    const lastDebug = link.lastFbDebug ? link.lastFbDebug.getTime() : 0
    if (Date.now() - lastDebug > SLOT_MS) {
      const origin2 = `https://${hostname}`
      // Dùng after() để đảm bảo scrape hoàn thành dù response đã trả cho FB bot
      after(async () => {
        // 2 bước: GET (Debug) → POST (Scrape Again) — đúng như thao tác trên Facebook Sharing Debugger
        const r = await triggerFbScrape(`${origin2}/${shortCode}`).catch((e: unknown) => { console.error('[FB slot-scrape error]', e); return null })
        // Do not refresh cooldown until Facebook really accepted the scrape.
        if (r?.ok) await prisma.link.update({ where: { id: link.id }, data: { lastFbDebug: new Date() } }).catch(() => { })
        else if (r) console.error('[FB slot-scrape fail]', r.message, r.errorCode)
      })
    }
  }

  // Chỉ áp dụng redirect rules cho người dùng thật, không áp dụng cho social bot
  if (!isSocialBot) {
    // Deep link redirect: nếu user dùng iOS/Android và link có deep link
    if (link.deepLinkIos || link.deepLinkAndroid) {
      const isIos = /iPhone|iPad|iPod/i.test(ua)
      const isAndroid = /Android/i.test(ua)
      if (isIos && link.deepLinkIos) {
        redirectUrl = link.deepLinkIos
      } else if (isAndroid && link.deepLinkAndroid) {
        redirectUrl = link.deepLinkAndroid
      }
    }

    // Redirect rules: Device > Country > Language
    let ruleMatched = false

    for (const rule of link.deviceRules) {
      if (rule.deviceType === deviceType) {
        redirectUrl = rule.redirectUrl
        ruleMatched = true
        break
      }
    }

    if (!ruleMatched) {
      for (const rule of link.countryRules) {
        if (rule.countryCode === country) {
          redirectUrl = rule.redirectUrl
          ruleMatched = true
          break
        }
      }
    }

    if (!ruleMatched) {
      for (const rule of link.languageRules) {
        const lang = language.toLowerCase()
        const code = rule.languageCode.toLowerCase()
        if (lang === code || lang.startsWith(code + '-') || lang.startsWith(code)) {
          redirectUrl = rule.redirectUrl
          break
        }
      }
    }
  }

  // Chỉ đếm click khi KHÔNG phải bot/crawler
  if (!isBot) {
    const clickPayload = {
      linkId: link.id,
      ip: ip || null,
      country: country || null,
      city: city || null,
      device: deviceType,
      deviceModel,
      browser,
      os,
      osVersion,
      referer: referer || null,
      language: language || null,
    }
    if (link.maxClicks !== null) {
      // Ghi click ngay (không buffer) để count luôn chính xác
      const maxClicksVal = link.maxClicks
      const ogAutoResetVal = link.ogAutoReset
      // Dùng after() để đảm bảo chạy xong sau response — kể cả trên Vercel serverless
      after(async () => {
        await prisma.click.create({ data: clickPayload }).catch(console.error)
        if (!ogAutoResetVal) return
        // ogAutoReset: sau khi ghi click xong, kiểm tra xem đã đạt giới hạn chưa
        const newCount = await prisma.click.count({ where: { linkId: link.id } })
        if (newCount >= maxClicksVal) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.link.update as any)({ where: { id: link.id }, data: { ogEnabled: false, maxClicks: null } })
          const originAR = `https://${hostname}`
          // 2 bước: GET (Debug) → POST (Scrape Again) — đúng như thao tác trên Facebook Sharing Debugger
          const r = await triggerFbScrape(`${originAR}/${shortCode}`).catch((e: unknown) => { console.error('[FB ogAutoReset error]', e); return null })
          if (r?.ok) await prisma.link.update({ where: { id: link.id }, data: { lastFbDebug: new Date() } }).catch(() => { })
          else if (r) console.error('[FB ogAutoReset fail]', shortCode, r.message, r.errorCode)
        }
      })
    } else {
      trackClick(clickPayload)
    }
  }

  // origin: luôn dùng https + hostname (hostname đã lấy từ 'host' header, đúng custom domain)
  // Không dùng x-forwarded-proto vì trên VPS nginx listen :80 → proto = http → URL sai
  const origin = `https://${hostname}`

  if (link.ogEnabled && (link.ogTitle || link.ogDescription || link.ogImage)) {
    const shortUrl = `${origin}/${shortCode}`
    const html = buildOgPage({
      redirectUrl,
      deepLinkIos: link.deepLinkIos,
      deepLinkAndroid: link.deepLinkAndroid,
      slotUrl: urlList.length > 1 ? slotUrl : null,
      ogTitle: link.ogTitle,
      ogDescription: link.ogDescription,
      ogImage: link.ogImage,
      shortUrl,
      linkId: link.id,
      origin,
      isSocialBot,
      ua,
    })
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (isSocialBot) {
    // Không redirect thẳng sang external URL vì nhiều site (Shopee, Lazada,...) block facebookexternalhit → 403
    // Serve trang HTML tối giản để FB nhận 200, canonical trỏ về redirectUrl
    const safeUrl = escapeHtml(redirectUrl)
    const minimalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="canonical" href="${safeUrl}"><meta property="og:url" content="${safeUrl}"><meta http-equiv="refresh" content="0;url=${safeUrl}"></head><body></body></html>`
    return new Response(minimalHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  // Normal redirect for real users
  return NextResponse.redirect(redirectUrl, { status: 302 })
}
