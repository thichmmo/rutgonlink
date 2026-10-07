import { buildTikTokAndroidLaunchUrl, buildTikTokOneLinkUrl, isIosFacebookUserAgent, isTikTokOneLinkUrl, isTikTokShortUrl, TIKTOK_ANDROID_HOSTS } from '@/lib/popup-link'
import { isAndroidUserAgent, popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'
import { resolveTikTokUrl } from '@/lib/tiktok-link'

const shortLinkCache = new Map<string, { value: Promise<string>; expiresAt: number }>()
const CACHE_LIMIT = 200

async function resolvePopupShortLink(url: string, platform: 'ios' | 'android' = 'ios') {
  const cacheKey = `${platform}:${url}`
  const cached = shortLinkCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  shortLinkCache.delete(cacheKey)
  if (shortLinkCache.size >= CACHE_LIMIT) shortLinkCache.delete(shortLinkCache.keys().next().value!)

  // Resolve before rendering, not inside the click handler: awaiting network on
  // the click loses the user gesture needed for app handoff. Coalesce readers,
  // but isolate Android's native PDP result from iOS OneLink results.
  const entry = { value: Promise.resolve(url), expiresAt: Date.now() + 5 * 60_000 }
  entry.value = resolveTikTokUrl(url, {
    stopAtProduct: true,
    signal: AbortSignal.timeout(4000),
    ...(platform === 'android' ? { maxUrlLength: 8192, preserveRawUrl: true, allowedHosts: TIKTOK_ANDROID_HOSTS } : {}),
  })
    .then(productUrl => platform === 'android' ? buildTikTokAndroidLaunchUrl(productUrl, url) : buildTikTokOneLinkUrl(productUrl))
    .then(launchUrl => {
      if (platform === 'android' ? launchUrl !== url : isTikTokOneLinkUrl(launchUrl)) return launchUrl
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

export async function preparePopupSettingsForRequest(settings: PopupSettings, userAgent: string): Promise<PopupSettings> {
  // Never reuse client-supplied or stale request metadata. Saved source fields are
  // immutable here, and both renderers receive only independently derived data.
  if (settings.tiktok.androidLaunchUrl !== undefined) {
    settings = { ...settings, tiktok: { ...settings.tiktok } }
    delete settings.tiktok.androidLaunchUrl
  }
  if (isAndroidUserAgent(userAgent) && popupAppliesToDevice(settings, userAgent)) {
    const url = settings.tiktok.androidUrl || settings.tiktok.url
    const launchUrl = isTikTokShortUrl(url)
      ? await resolvePopupShortLink(url, 'android')
      : buildTikTokAndroidLaunchUrl(url)
    return launchUrl === url ? settings : {
      ...settings,
      tiktok: { ...settings.tiktok, androidLaunchUrl: launchUrl },
    }
  }
  if (!isIosFacebookUserAgent(userAgent) || !popupAppliesToDevice(settings, userAgent)) return settings
  const url = settings.tiktok.iosUrl || settings.tiktok.url
  if (!isTikTokShortUrl(url)) return settings
  const launchUrl = await resolvePopupShortLink(url)
  return launchUrl === url ? settings : {
    ...settings,
    tiktok: { ...settings.tiktok, iosUrl: launchUrl, iosMode: 'onelink' },
  }
}
