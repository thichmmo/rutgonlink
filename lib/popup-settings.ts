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
}

export type PopupSettings = {
  shopee: PopupPlatformSettings
  tiktok: PopupTikTokSettings
  cooldownMinutes: number
  forceChromeAndroid: boolean
  forceSafariIos: boolean
}

export const defaultPopupSettings = (firstUrl = '', secondUrl = ''): PopupSettings => ({
  shopee: {
    enabled: true,
    androidEnabled: true,
    iosEnabled: true,
    url: firstUrl,
    delaySeconds: 1,
    imageUrl: null,
  },
  tiktok: {
    enabled: true,
    androidEnabled: true,
    iosEnabled: true,
    url: secondUrl,
    androidUrl: secondUrl,
    iosUrl: secondUrl,
    delaySeconds: 10,
    imageUrl: null,
    iosMode: 'desktop',
  },
  cooldownMinutes: 30,
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
  return {
    shopee: platformSettings(input.shopee, fallback.shopee),
    tiktok: {
      ...tiktokBase,
      androidUrl: typeof tiktokInput.androidUrl === 'string' ? tiktokInput.androidUrl : tiktokBase.url,
      iosUrl: typeof tiktokInput.iosUrl === 'string' ? tiktokInput.iosUrl : tiktokBase.url,
      iosMode: input.tiktok && typeof input.tiktok === 'object' && (input.tiktok as Record<string, unknown>).iosMode === 'onelink'
        ? 'onelink'
        : 'desktop',
    },
    cooldownMinutes: positiveInteger(input.cooldownMinutes, fallback.cooldownMinutes, 10080),
    forceChromeAndroid: input.forceChromeAndroid === true,
    forceSafariIos: input.forceSafariIos === true,
  }
}

export function isIosUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

export function isAndroidUserAgent(userAgent: string) {
  return /android/i.test(userAgent)
}

export function getPopupStep(settings: PopupSettings, step: 0 | 1, userAgent: string) {
  if (step === 0) {
    return {
      platform: 'Shopee',
      url: settings.shopee.url,
      imageUrl: settings.shopee.imageUrl,
      delaySeconds: settings.shopee.delaySeconds,
      forceBrowser: isAndroidUserAgent(userAgent) ? settings.forceChromeAndroid : isIosUserAgent(userAgent) ? settings.forceSafariIos : false,
    }
  }

  return {
    platform: 'TikTok',
    url: isIosUserAgent(userAgent) ? settings.tiktok.iosUrl : settings.tiktok.androidUrl,
    imageUrl: settings.tiktok.imageUrl,
    delaySeconds: settings.tiktok.delaySeconds,
    forceBrowser: isAndroidUserAgent(userAgent) ? settings.forceChromeAndroid : isIosUserAgent(userAgent) ? settings.forceSafariIos : false,
  }
}
