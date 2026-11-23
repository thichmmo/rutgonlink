import { buildAndroidPopupLaunchUrl, getPopupLinkOpenMode, getShopeeIosLaunchUrl, getTikTokIosLaunchUrl, isAndroidDeviceUserAgent, isTikTokOneLinkUrl } from '@/lib/popup-link'
import { isFacebookUserAgent } from '@/lib/traffic-source'

export type PopupPlatformSettings = {
  enabled: boolean
  androidEnabled: boolean
  iosEnabled: boolean
  url: string
  delaySeconds: number
  imageUrl: string | null
}

export type PopupTikTokSettings = PopupPlatformSettings & {
  androidUrl: string
  iosUrl: string
  iosMode: 'desktop' | 'onelink'
  // Request-only launch metadata. normalizePopupSettings deliberately never reads it.
  androidLaunchUrl?: string
}

export type PopupSettings = {
  shopee: PopupPlatformSettings
  tiktok: PopupTikTokSettings
  cooldownMinutes: number
  onlyFromFacebook: boolean
  forceChromeAndroid: boolean
  forceSafariIos: boolean
}

// Keep the default creative in one place so new templates and legacy records
// render the same compact Boclink-style popup without requiring an upload.
export const DEFAULT_SHOPEE_IMAGE_URL = 'https://pub-efb18fd93e8d4d56a30635057bd6f5c4.r2.dev/defaults/shopee-default.webp'
export const DEFAULT_TIKTOK_IMAGE_URL = 'https://pub-efb18fd93e8d4d56a30635057bd6f5c4.r2.dev/defaults/tiktok-default.webp'
export const DEVTOOLS_REDIRECT_URL = 'https://mesale.vn'

export const defaultPopupSettings = (firstUrl = '', secondUrl = ''): PopupSettings => ({
  shopee: {
    enabled: true,
    androidEnabled: true,
    iosEnabled: true,
    url: firstUrl,
    delaySeconds: 1,
    imageUrl: DEFAULT_SHOPEE_IMAGE_URL,
  },
  tiktok: {
    enabled: true,
    androidEnabled: true,
    iosEnabled: true,
    url: secondUrl,
    androidUrl: secondUrl,
    iosUrl: secondUrl,
    delaySeconds: 10,
    imageUrl: DEFAULT_TIKTOK_IMAGE_URL,
    iosMode: 'desktop',
  },
  cooldownMinutes: 30,
  onlyFromFacebook: true,
  forceChromeAndroid: false,
  forceSafariIos: false,
})

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(max, Math.round(parsed)))
}

function platformSettings(value: unknown, fallback: PopupPlatformSettings): PopupPlatformSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: input.enabled !== false,
    androidEnabled: input.androidEnabled !== false,
    iosEnabled: input.iosEnabled !== false,
    url: typeof input.url === 'string' ? input.url : fallback.url,
    delaySeconds: positiveInteger(input.delaySeconds, fallback.delaySeconds, 3600),
    imageUrl: typeof input.imageUrl === 'string' && input.imageUrl ? input.imageUrl : fallback.imageUrl,
  }
}

export function normalizePopupSettings(value: unknown, firstUrl = '', secondUrl = ''): PopupSettings {
  const fallback = defaultPopupSettings(firstUrl, secondUrl)
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const tiktokBase = platformSettings(input.tiktok, fallback.tiktok)
  const tiktokInput = input.tiktok && typeof input.tiktok === 'object' ? input.tiktok as Record<string, unknown> : {}
  const iosUrl = typeof tiktokInput.iosUrl === 'string' && tiktokInput.iosUrl.trim() ? tiktokInput.iosUrl : tiktokBase.url
  const usesOneLink = tiktokInput.iosMode === 'onelink' || isTikTokOneLinkUrl(iosUrl)
  return {
    shopee: platformSettings(input.shopee, fallback.shopee),
    tiktok: {
      ...tiktokBase,
      androidUrl: typeof tiktokInput.androidUrl === 'string' && tiktokInput.androidUrl.trim() ? tiktokInput.androidUrl : tiktokBase.url,
      iosUrl,
      iosMode: usesOneLink ? 'onelink' : 'desktop',
    },
    cooldownMinutes: positiveInteger(input.cooldownMinutes, fallback.cooldownMinutes, 10080),
    // Default existing and new popups to Facebook-only unless explicitly toggled off.
    onlyFromFacebook: input.onlyFromFacebook !== false,
    forceChromeAndroid: input.forceChromeAndroid === true,
    forceSafariIos: input.forceSafariIos === true,
  }
}

export function isIosUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

export function isAndroidUserAgent(userAgent: string) {
  return isAndroidDeviceUserAgent(userAgent)
}

export function isMobileUserAgent(userAgent: string) {
  return isIosUserAgent(userAgent) || isAndroidUserAgent(userAgent)
}

export type PopupEligibilityOptions = {
  isFacebookSource?: boolean
}

export function popupAppliesToDevice(settings: PopupSettings, userAgent: string, options?: PopupEligibilityOptions) {
  // Gate mobile traffic only; desktop visitors read the article directly.
  if (!isMobileUserAgent(userAgent)) return false
  // Enforce Facebook-only popup visibility fail-closed unless explicitly disabled on the popup.
  const facebookMatched = options?.isFacebookSource ?? isFacebookUserAgent(userAgent)
  if (settings.onlyFromFacebook && !facebookMatched) return false
  const platforms = [settings.shopee, settings.tiktok]
  return platforms.every(platform => platform.enabled && (
    isIosUserAgent(userAgent) ? platform.iosEnabled :
      isAndroidUserAgent(userAgent) ? platform.androidEnabled : true
  ))
}

export function getPopupStep(settings: PopupSettings, step: 0 | 1, userAgent: string) {
  const forceBrowser = isAndroidUserAgent(userAgent) && settings.forceChromeAndroid ? 'Chrome'
    : isIosUserAgent(userAgent) && settings.forceSafariIos ? 'Safari' : null
  if (step === 0) {
    // Android wraps /opaanlp/ in a scheme=https intent; iOS wraps /opaanlp/ in shopeevn://reactPath
    // while keeping step.url as the untouched HTTPS /opaanlp/ URL for web fallback.
    const launchUrl = isAndroidUserAgent(userAgent)
      ? buildAndroidPopupLaunchUrl(settings.shopee.url, 'SHOPEE', userAgent)
      : getShopeeIosLaunchUrl(settings.shopee.url, userAgent)
    return {
      platform: 'Shopee',
      url: settings.shopee.url,
      launchUrl,
      openMode: getPopupLinkOpenMode(launchUrl, 'SHOPEE', { userAgent }),
      imageUrl: settings.shopee.imageUrl,
      delaySeconds: settings.shopee.delaySeconds,
      forceBrowser,
    }
  }

  const url = getTikTokIosLaunchUrl((isIosUserAgent(userAgent) ? settings.tiktok.iosUrl : settings.tiktok.androidUrl) || settings.tiktok.url, userAgent)
  const launchUrl = isAndroidUserAgent(userAgent) ? buildAndroidPopupLaunchUrl(url, 'TIKTOK', userAgent) : url
  return {
    platform: 'TikTok',
    url,
    // Chrome keeps raw HTTPS; OEM browsers that disable https App Links receive a scheme=https intent with web fallback.
    launchUrl,
    openMode: getPopupLinkOpenMode(launchUrl, 'TIKTOK', { userAgent }),
    imageUrl: settings.tiktok.imageUrl,
    delaySeconds: settings.tiktok.delaySeconds,
    forceBrowser,
  }
}

export function updateTikTokPopupUrl(settings: PopupTikTokSettings, url: string): PopupTikTokSettings {
  // Manual Android/general URL edits must not overwrite a separately configured iOS link.
  const iosUrl = settings.iosUrl && settings.iosUrl !== settings.url ? settings.iosUrl : url
  return { ...settings, url, androidUrl: url, iosUrl, iosMode: isTikTokOneLinkUrl(iosUrl) ? 'onelink' : settings.iosMode }
}
