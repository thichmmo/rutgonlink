import { isValidPopupAffiliateUrl, MAX_POPUP_AFFILIATE_URL_LENGTH } from '@/lib/popup-affiliate-url'

export const SHOPEE_MARKET_DOMAINS = ['shopee.vn', 'shopee.co.th', 'shopee.sg', 'shopee.com.my', 'shopee.ph', 'shopee.co.id'] as const
export const SHOPEE_SHORT_HOSTS = ['shope.ee', 'shp.ee'] as const

// s.shopee.vn / shope.ee serve a 200 JS app-shim shell (which later client-redirects with Referer: https://s.shopee.vn/)
// to mobile UAs, whereas Desktop Chrome UA receives an immediate 301 Location header to https://shopee.vn/opaanlp/...
export const DESKTOP_SHORTENER_REDIRECT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

function matchesDomainList(hostname: string, domains: readonly string[]) {
  const host = hostname.toLowerCase()
  return domains.some(value => host === value || host.endsWith(`.${value}`))
}

export function isShopeeShortenerHost(hostname: string) {
  const host = hostname.toLowerCase()
  return matchesDomainList(host, SHOPEE_SHORT_HOSTS) || /^s\.shopee\./i.test(host)
}

export function isAllowedShopeeDestinationHost(hostname: string) {
  const host = hostname.toLowerCase()
  return matchesDomainList(host, SHOPEE_MARKET_DOMAINS) || isShopeeShortenerHost(host)
}

export function isShopeeShortUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && !parsed.username && !parsed.password && !parsed.port
      && isShopeeShortenerHost(parsed.hostname)
  } catch {
    return false
  }
}

export async function expandShopeeShortUrl(url: string, options?: { signal?: AbortSignal }): Promise<string> {
  if (!isShopeeShortUrl(url)) return url
  const signal = options?.signal ?? AbortSignal.timeout(5000)
  let current = url
  try {
    for (let hop = 0; hop < 6; hop += 1) {
      const currentHost = new URL(current).hostname.toLowerCase()
      // Stop as soon as the shortener resolves to a market landing URL (e.g. shopee.vn/opaanlp/...)
      // so popup saves never download the 300KB landing HTML or alter signed query bytes.
      if (!isShopeeShortenerHost(currentHost)) return current
      const response = await fetch(current, {
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        headers: { 'user-agent': DESKTOP_SHORTENER_REDIRECT_UA, accept: 'text/html,*/*', 'accept-language': 'vi-VN,vi;q=0.9' },
        signal,
      })
      const location = response.headers.get('location')
      if (!location || ![301, 302, 303, 307, 308].includes(response.status)) break
      const next = new URL(location, current)
      if (
        next.href.length > MAX_POPUP_AFFILIATE_URL_LENGTH
        || !isValidPopupAffiliateUrl(next.href)
        || !isAllowedShopeeDestinationHost(next.hostname)
      ) {
        return url
      }
      current = next.href
    }
    return current
  } catch {
    // Keep the user-supplied short URL usable when offline or when upstream times out.
    return url
  }
}
