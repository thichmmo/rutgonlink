import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getManagedContentUserId } from '@/lib/content-management'
import { expandAndConvertTikTokLink, TikTokLinkError } from '@/lib/tiktok-link'
import { isValidPopupAffiliateUrl, MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_INVALID, POPUP_AFFILIATE_URL_TOO_LONG } from '@/lib/popup-affiliate-url'

const schema = z.object({ url: z.string().trim()
  .max(MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_TOO_LONG)
  .refine(isValidPopupAffiliateUrl, POPUP_AFFILIATE_URL_INVALID) })
const allowedHosts = ['shopee.vn', 'shopee.co.th', 'shopee.sg', 'shopee.com.my', 'shopee.ph', 'shopee.co.id', 'tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com']

function allowed(hostname: string) {
  const host = hostname.toLowerCase()
  return allowedHosts.some(value => host === value || host.endsWith(`.${value}`))
}

function metadata(html: string) {
  const read = (name: string) => {
    const expression = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
    return html.match(expression)?.[1] || null
  }
  return { title: read('og:title'), image: read('og:image') }
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
    if (!allowed(input.hostname)) return NextResponse.json({ url }, { status: 200 })
    if (input.hostname.toLowerCase().endsWith('tiktok.com')) {
      try {
        const result = await expandAndConvertTikTokLink(url, { maxUrlLength: MAX_POPUP_AFFILIATE_URL_LENGTH })
        const destination = result.convertedUrl || url
        const warning = unusableResult(destination)
        if (warning) return keepOriginal(url, warning)
        return NextResponse.json({ url: destination, title: result.title, image: null, originalUrl: url })
      } catch (error) {
        // Do not fall through to a second network resolver after a failed TikTok lookup.
        return keepOriginal(url, error instanceof TikTokLinkError ? error.message : 'Không thể lấy metadata, giữ URL gốc')
      }
    }
    let current = url
    for (let count = 0; count < 5; count += 1) {
      const response = await fetch(current, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html,*/*' }, signal: AbortSignal.timeout(8000) })
      const location = response.headers.get('location')
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) {
        const html = (await response.text()).slice(0, 500_000)
        return NextResponse.json({ url: current, originalUrl: url, ...metadata(html) })
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
