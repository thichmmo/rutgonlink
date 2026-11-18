export const GOOGLE_REDIRECT_URL = 'https://mesale.vn'
export const FACEBOOK_HANDOFF_PARAM = '_fbh'

// Match Facebook & Messenger In-App WebViews across iOS and Android (excluding external Meta link crawlers).
const FACEBOOK_IN_APP_UA_PATTERN = /fban|fbav|fbios|fb_iab|fb4a|fbandroid|fblite|orca-android|messenger/i
const FACEBOOK_REFERER_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com|messenger\.com|m\.me)$/i
const FACEBOOK_ANDROID_APP_REFERER_PATTERN = /^android-app:\/\/com\.facebook\.(?:katana|lite|orca|mlite|pages\.app)(?:\/|$)/i

// Match Google Search App (GSA/GoogleApp) and Google crawlers/scanners, never ordinary Chrome/CriOS browsers.
const GOOGLE_UA_PATTERN = /\bGSA\/|\bGoogleApp\b|Googlebot|AdsBot-Google|Mediapartners-Google|APIs-Google|GoogleOther|Google-InspectionTool|Google-Read-Aloud|Storebot-Google|Google-Safety|GoogleProducer|Google-Site-Verification|DuplexWeb-Google|FeedFetcher-Google|GoogleImageProxy|GoogleFavicon/i
const GOOGLE_REFERER_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*google\.(?:com|net|org|co\.[a-z]{2}|com\.[a-z]{2,3}|[a-z]{2,3})$|^(?:www\.)?g\.co$/i
const GOOGLE_ANDROID_APP_REFERER_PATTERN = /^android-app:\/\/com\.google\.android\.(?:googlequicksearchbox|gm|apps\.searchlite)(?:\/|$)/i

export type SearchParamsInput =
  | string
  | URL
  | URLSearchParams
  | { searchParams: URLSearchParams }
  | Record<string, string | string[] | undefined>
  | null
  | undefined

function readParam(source: SearchParamsInput, key: string): string {
  if (!source) return ''
  try {
    if (typeof (source as URLSearchParams).get === 'function') {
      return ((source as URLSearchParams).get(key) || '').trim()
    }
    // Next.js NextURL composes URL rather than extending globalThis.URL (instanceof URL === false).
    if (typeof source === 'object' && 'searchParams' in source && source.searchParams && typeof (source.searchParams as URLSearchParams).get === 'function') {
      return ((source.searchParams as URLSearchParams).get(key) || '').trim()
    }
    if (typeof source === 'string') {
      const trimmed = source.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('?')) return (new URLSearchParams(trimmed).get(key) || '').trim()
      if (/^https?:\/\//i.test(trimmed)) return (new URL(trimmed).searchParams.get(key) || '').trim()
      return (new URLSearchParams(trimmed).get(key) || '').trim()
    }
    if (typeof source === 'object') {
      const raw = (source as Record<string, string | string[] | undefined>)[key]
      if (typeof raw === 'string') return raw.trim()
      if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim()
    }
  } catch {
    return ''
  }
  return ''
}

export function isFacebookUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false
  return FACEBOOK_IN_APP_UA_PATTERN.test(userAgent)
}

export function isFacebookReferer(referer?: string | null): boolean {
  if (!referer) return false
  const trimmed = referer.trim()
  if (!trimmed) return false
  if (FACEBOOK_ANDROID_APP_REFERER_PATTERN.test(trimmed)) return true
  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/i.test(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    return FACEBOOK_REFERER_HOST_PATTERN.test(host)
  } catch {
    return false
  }
}

export function hasFacebookClickId(urlOrSearch?: SearchParamsInput): boolean {
  return Boolean(readParam(urlOrSearch, 'fbclid'))
}

export function extractFacebookHandoffToken(urlOrSearch?: SearchParamsInput): string {
  return readParam(urlOrSearch, FACEBOOK_HANDOFF_PARAM)
}

export function isGoogleUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false
  return GOOGLE_UA_PATTERN.test(userAgent)
}

export function isGoogleReferer(referer?: string | null): boolean {
  if (!referer) return false
  const trimmed = referer.trim()
  if (!trimmed) return false
  if (GOOGLE_ANDROID_APP_REFERER_PATTERN.test(trimmed)) return true
  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/i.test(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    return GOOGLE_REFERER_HOST_PATTERN.test(host)
  } catch {
    return false
  }
}

export function hasGoogleClickParams(urlOrSearch?: SearchParamsInput): boolean {
  if (!urlOrSearch) return false
  if (readParam(urlOrSearch, 'gclid') || readParam(urlOrSearch, 'gbraid') || readParam(urlOrSearch, 'wbraid') || readParam(urlOrSearch, 'srsltid')) {
    return true
  }
  return readParam(urlOrSearch, 'utm_source').toLowerCase() === 'google'
}

export function isGoogleTrafficSource(input: {
  userAgent?: string | null
  referer?: string | null
  url?: SearchParamsInput
}): boolean {
  return isGoogleUserAgent(input.userAgent) || isGoogleReferer(input.referer) || hasGoogleClickParams(input.url)
}
