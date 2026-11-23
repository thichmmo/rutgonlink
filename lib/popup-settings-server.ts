import { buildTikTokIosLaunchUrl, isIosUserAgent, isTikTokIosRedirectUrl, isTikTokOneLinkUrl, isTikTokShortUrl } from '@/lib/popup-link'
import { popupAppliesToDevice, type PopupEligibilityOptions, type PopupSettings } from '@/lib/popup-settings'
import { expandShopeeShortUrl, isShopeeShortUrl } from '@/lib/shopee-link'
import { resolveTikTokUrl } from '@/lib/tiktok-link'

const shortLinkCache = new Map<string, { value: Promise<string>; expiresAt: number }>()
const CACHE_LIMIT = 200

function evictOldestIfNeeded() {
  if (shortLinkCache.size >= CACHE_LIMIT) shortLinkCache.delete(shortLinkCache.keys().next().value!)
}

async function resolvePopupShopeeShortLink(url: string) {
  const cacheKey = `shopee:${url}`
  const cached = shortLinkCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  shortLinkCache.delete(cacheKey)
  evictOldestIfNeeded()

  // Expand legacy unexpanded s.shopee.* / shope.ee / shp.ee popups to shopee.vn/opaanlp/... before rendering
  // so iOS Universal Links match shopee.vn AASA directly and never pass s.shopee.vn JS referral.
  const entry = { value: Promise.resolve(url), expiresAt: Date.now() + 5 * 60_000 }
  entry.value = expandShopeeShortUrl(url, { signal: AbortSignal.timeout(4000) })
    .then(expanded => {
      if (expanded !== url && !isShopeeShortUrl(expanded)) return expanded
      entry.expiresAt = Date.now() + 15_000
      return url
    })
    .catch(() => {
      entry.expiresAt = Date.now() + 15_000
      return url
    })
  shortLinkCache.set(cacheKey, entry)
  return entry.value
}

async function resolvePopupShortLink(url: string) {
  const cacheKey = `ios:${url}`
  const cached = shortLinkCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  shortLinkCache.delete(cacheKey)
  evictOldestIfNeeded()

  // Resolve before rendering, not inside the click handler: awaiting network on
  // the click loses the user gesture needed for app handoff. Android uses its
  // unchanged source URL and must not resolve or reuse this iOS launch link.
  const entry = { value: Promise.resolve(url), expiresAt: Date.now() + 5 * 60_000 }
  entry.value = resolveTikTokUrl(url, {
    stopAtProduct: true,
    signal: AbortSignal.timeout(4000),
  })
    .then(productUrl => buildTikTokIosLaunchUrl(productUrl))
    .then(launchUrl => {
      if (isTikTokIosRedirectUrl(launchUrl) || isTikTokOneLinkUrl(launchUrl)) return launchUrl
      entry.expiresAt = Date.now() + 15_000
      return url
    })
    .catch(() => {
      // A failed upstream lookup keeps the original link usable and retries soon.
      entry.expiresAt = Date.now() + 15_000
      return url
    })
  shortLinkCache.set(cacheKey, entry)
  return entry.value
}

export async function preparePopupSettingsForRequest(settings: PopupSettings, userAgent: string, options?: PopupEligibilityOptions): Promise<PopupSettings> {
  // Never reuse client-supplied or stale request metadata. Saved source fields are
  // immutable here, and both renderers receive only independently derived data.
  if (settings.tiktok.androidLaunchUrl !== undefined) {
    settings = { ...settings, tiktok: { ...settings.tiktok } }
    delete settings.tiktok.androidLaunchUrl
  }
  if (!isIosUserAgent(userAgent) || !popupAppliesToDevice(settings, userAgent, options)) return settings
  const shopeeUrl = settings.shopee.url
  const tiktokUrl = settings.tiktok.iosUrl || settings.tiktok.url
  const needsShopeeExpand = isShopeeShortUrl(shopeeUrl)
  const needsTikTokExpand = isTikTokShortUrl(tiktokUrl)
  if (!needsShopeeExpand && !needsTikTokExpand) return settings

  const [resolvedShopeeUrl, resolvedTikTokUrl] = await Promise.all([
    needsShopeeExpand ? resolvePopupShopeeShortLink(shopeeUrl) : Promise.resolve(shopeeUrl),
    needsTikTokExpand ? resolvePopupShortLink(tiktokUrl) : Promise.resolve(tiktokUrl),
  ])
  if (resolvedShopeeUrl === shopeeUrl && resolvedTikTokUrl === tiktokUrl) return settings
  return {
    ...settings,
    ...(resolvedShopeeUrl !== shopeeUrl ? { shopee: { ...settings.shopee, url: resolvedShopeeUrl } } : {}),
    ...(resolvedTikTokUrl !== tiktokUrl
      ? { tiktok: { ...settings.tiktok, iosUrl: resolvedTikTokUrl, iosMode: isTikTokOneLinkUrl(resolvedTikTokUrl) ? 'onelink' : settings.tiktok.iosMode } }
      : {}),
  }
}
