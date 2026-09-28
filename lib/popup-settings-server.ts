import { buildTikTokOneLinkUrl, isIosFacebookUserAgent, isTikTokOneLinkUrl, isTikTokShortUrl } from '@/lib/popup-link'
import { popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'
import { resolveTikTokUrl } from '@/lib/tiktok-link'

const shortLinkCache = new Map<string, { value: Promise<string>; expiresAt: number }>()
const CACHE_LIMIT = 200

async function resolvePopupShortLink(url: string) {
  const cached = shortLinkCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  shortLinkCache.delete(url)
  if (shortLinkCache.size >= CACHE_LIMIT) shortLinkCache.delete(shortLinkCache.keys().next().value!)

  // Resolve before rendering, not inside the click handler: awaiting network on
  // the click loses the user gesture needed for iOS app handoff. Coalesce readers.
  const entry = { value: Promise.resolve(url), expiresAt: Date.now() + 5 * 60_000 }
  entry.value = resolveTikTokUrl(url, { stopAtProduct: true, signal: AbortSignal.timeout(4000) })
    .then(buildTikTokOneLinkUrl)
    .then(launchUrl => {
      if (isTikTokOneLinkUrl(launchUrl)) return launchUrl
      entry.expiresAt = Date.now() + 15_000
      return url
    })
    .catch(() => {
      // A failed upstream lookup keeps the original link usable and retries soon.
      entry.expiresAt = Date.now() + 15_000
      return url
    })
  shortLinkCache.set(url, entry)
  return entry.value
}

export async function preparePopupSettingsForRequest(settings: PopupSettings, userAgent: string): Promise<PopupSettings> {
  if (!isIosFacebookUserAgent(userAgent) || !popupAppliesToDevice(settings, userAgent)) return settings
  const url = settings.tiktok.iosUrl || settings.tiktok.url
  if (!isTikTokShortUrl(url)) return settings
  const launchUrl = await resolvePopupShortLink(url)
  return launchUrl === url ? settings : {
    ...settings,
    tiktok: { ...settings.tiktok, iosUrl: launchUrl, iosMode: 'onelink' },
  }
}
