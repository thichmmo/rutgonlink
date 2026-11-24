import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getManagedContentUserId } from '@/lib/content-management'
import { expandAndConvertTikTokLink, extractTikTokOgInfo, TikTokLinkError } from '@/lib/tiktok-link'
import { isValidPopupAffiliateUrl, MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_INVALID, POPUP_AFFILIATE_URL_TOO_LONG } from '@/lib/popup-affiliate-url'
import { DESKTOP_SHORTENER_REDIRECT_UA, isShopeeShortenerHost, SHOPEE_MARKET_DOMAINS, SHOPEE_SHORT_HOSTS } from '@/lib/shopee-link'

const schema = z.object({ url: z.string().trim()
  .max(MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_TOO_LONG)
  .refine(isValidPopupAffiliateUrl, POPUP_AFFILIATE_URL_INVALID) })

const TIKTOK_WRAPPER_HOSTS = ['tiktokv.com', 'onelink.me']
const allowedHosts = [...SHOPEE_MARKET_DOMAINS, ...SHOPEE_SHORT_HOSTS, 'tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com', ...TIKTOK_WRAPPER_HOSTS]

// Shopee blocks facebookexternalhit/Twitterbot with 403 on /product/ SSR pages, whereas WhatsApp receives clean 200 OG tags.
const SHOPEE_PREVIEW_UA = 'WhatsApp/2.24.12.78 A'

function matchesDomainList(hostname: string, domains: readonly string[]) {
  const host = hostname.toLowerCase()
  return domains.some(value => host === value || host.endsWith(`.${value}`))
}

function allowed(hostname: string) {
  return matchesDomainList(hostname, allowedHosts) || isShopeeShortenerHost(hostname)
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function safeImageUrl(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = new URL(decodeHtmlEntities(raw).trim())
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username || parsed.password) return null
    // Ignore Shopee's generic homepage logo returned by client-side ULS fallback shells.
    if (/deo\.shopeemobile\.com\/.*\/homepagefe\//i.test(parsed.href)) return null
    return parsed.href
  } catch {
    return null
  }
}

function cleanProductTitle(raw: string | null) {
  if (!raw) return null
  const cleaned = decodeHtmlEntities(raw)
    .replace(/\s*\|\s*Shopee(?:\s+Việt\s+Nam|\s+Vietnam|\s+[A-Z]{2,})?\s*$/i, '')
    .trim()
  if (
    !cleaned ||
    /^Shopee(?:\s+Việt\s+Nam|\s+Vietnam)?(?:\s*\|\s*(?:Mua\s+và\s+Bán|Buy\s+and\s+Sell).*)?$/i.test(cleaned)
  ) {
    return null
  }
  return cleaned
}

function metadata(html: string) {
  const read = (name: string) => {
    for (const tagMatch of html.matchAll(/<meta\b[^>]*>/gi)) {
      const tag = tagMatch[0]
      const prop = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]
      if (!prop || prop.toLowerCase() !== name.toLowerCase()) continue
      const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]
      if (content) return content
    }
    return null
  }
  const rawTitle = read('og:title')
  return { title: cleanProductTitle(rawTitle), image: safeImageUrl(read('og:image')) }
}

function extractShopeeProductPreviewUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.toLowerCase()
    const marketDomain = SHOPEE_MARKET_DOMAINS.find(d => host === d || host.endsWith(`.${d}`))
    if (!marketDomain) return null
    // Only perform a secondary /product/<shopId>/<itemId> lookup when the affiliate URL lands on
    // a client-side JS redirector (/opaanlp/ or /universal-link/) that carries no OG tags itself.
    const redirectorMatch = parsed.pathname.match(/^\/opaanlp\/(\d+)\/(\d+)(?:\/|$)/i)
      || parsed.pathname.match(/^\/universal-link\/(?:product\/)?(\d+)\/(\d+)(?:\/|$)/i)
      || (parsed.pathname.startsWith('/universal-link/') ? parsed.pathname.match(/-i\.(\d+)\.(\d+)$/i) : null)
    if (redirectorMatch) {
      return `https://${marketDomain}/product/${redirectorMatch[1]}/${redirectorMatch[2]}`
    }
    const redir = parsed.searchParams.get('redir')
    if (redir && redir !== rawUrl) return extractShopeeProductPreviewUrl(redir)
    return null
  } catch {
    return null
  }
}

function unusableResult(url: string) {
  if (url.length > MAX_POPUP_AFFILIATE_URL_LENGTH) return POPUP_AFFILIATE_URL_TOO_LONG
  return isValidPopupAffiliateUrl(url) ? null : POPUP_AFFILIATE_URL_INVALID
}

function keepOriginal(url: string, warning: string) {
  // A warning tells the editor to keep its existing platform-specific destination.
  return NextResponse.json({ url, originalUrl: url, warning })
}

export async function POST(req: NextRequest) {
  if (!(await getManagedContentUserId())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let originalUrl: string | null = null
  try {
    const { url } = schema.parse(await req.json())
    originalUrl = url
    const input = new URL(url)
    const inputHost = input.hostname.toLowerCase()
    if (!allowed(inputHost)) return NextResponse.json({ url }, { status: 200 })
    if (matchesDomainList(inputHost, TIKTOK_WRAPPER_HOSTS)) {
      const preview = extractTikTokOgInfo(url)
      return NextResponse.json({ url, originalUrl: url, title: preview.title, image: preview.image })
    }
    if (inputHost === 'tiktok.com' || inputHost.endsWith('.tiktok.com')) {
      try {
        const result = await expandAndConvertTikTokLink(url, { maxUrlLength: MAX_POPUP_AFFILIATE_URL_LENGTH })
        const destination = result.convertedUrl || url
        const warning = unusableResult(destination)
        if (warning) return keepOriginal(url, warning)
        return NextResponse.json({ url: destination, title: result.title, image: result.image, originalUrl: url })
      } catch (error) {
        // Do not fall through to a second network resolver after a failed TikTok lookup.
        return keepOriginal(url, error instanceof TikTokLinkError ? error.message : 'Không thể lấy metadata, giữ URL gốc')
      }
    }
    let current = url
    for (let count = 0; count < 6; count += 1) {
      const currentHost = new URL(current).hostname.toLowerCase()
      // Never fetch /opaanlp/ or /universal-link/ affiliate URLs on the server (avoids touching signed uls_trackid
      // endpoints and skips 300KB OG-less HTML shells); look up OG metadata from clean /product/<shopId>/<itemId> directly.
      const directPreviewUrl = !isShopeeShortenerHost(currentHost) ? extractShopeeProductPreviewUrl(current) : null
      if (directPreviewUrl) {
        let meta: { title: string | null; image: string | null } = { title: null, image: null }
        try {
          const previewRes = await fetch(directPreviewUrl, {
            redirect: 'manual',
            referrerPolicy: 'no-referrer',
            headers: { 'user-agent': SHOPEE_PREVIEW_UA, accept: 'text/html,*/*', 'accept-language': 'vi-VN,vi;q=0.9' },
            signal: AbortSignal.timeout(6000),
          })
          if (previewRes.ok) meta = metadata((await previewRes.text()).slice(0, 500_000))
        } catch {
          // Keep the resolved opaanlp affiliate URL intact even if Shopee's preview fetch times out.
        }
        return NextResponse.json({ url: current, originalUrl: url, ...meta })
      }
      const ua = isShopeeShortenerHost(currentHost) ? DESKTOP_SHORTENER_REDIRECT_UA : SHOPEE_PREVIEW_UA
      const response = await fetch(current, {
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        headers: { 'user-agent': ua, accept: 'text/html,*/*', 'accept-language': 'vi-VN,vi;q=0.9' },
        signal: AbortSignal.timeout(8000),
      })
      const location = response.headers.get('location')
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) {
        const html = (await response.text()).slice(0, 500_000)
        let meta = metadata(html)
        // Non-product campaign/shop short links on s.shopee.vn also expose OG tags directly to WhatsApp UA.
        if (!meta.title && !meta.image && isShopeeShortenerHost(inputHost)) {
          try {
            const shortMetaRes = await fetch(url, {
              redirect: 'manual',
              referrerPolicy: 'no-referrer',
              headers: { 'user-agent': SHOPEE_PREVIEW_UA, accept: 'text/html,*/*', 'accept-language': 'vi-VN,vi;q=0.9' },
              signal: AbortSignal.timeout(6000),
            })
            if (shortMetaRes.ok) meta = metadata((await shortMetaRes.text()).slice(0, 500_000))
          } catch {
            // Best-effort fallback only.
          }
        }
        return NextResponse.json({ url: current, originalUrl: url, ...meta })
      }
      const next = new URL(location, current)
      const warning = unusableResult(next.href)
      if (warning) return keepOriginal(url, warning)
      if (!allowed(next.hostname)) break
      current = next.href
    }
    return NextResponse.json({ url: current, originalUrl: url })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    return NextResponse.json({ url: originalUrl, originalUrl, warning: 'Không thể lấy metadata, giữ URL gốc' }, { status: 200 })
  }
}
