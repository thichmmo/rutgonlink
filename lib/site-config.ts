const LOCAL_SITE_URL = 'http://localhost:3000'
const PRODUCTION_SITE_URL = 'https://rutgonlink.site'

function getFallbackSiteUrl(): string {
  return process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : LOCAL_SITE_URL
}

function normalizeSiteUrl(value: string | undefined): string {
  const rawValue = value?.trim()
  if (!rawValue) return getFallbackSiteUrl()

  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue)
  if (hasExplicitScheme && !/^https?:\/\//i.test(rawValue)) return getFallbackSiteUrl()

  const candidate = hasExplicitScheme ? rawValue : `https://${rawValue}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return getFallbackSiteUrl()
    // Chỉ giữ origin để path/query nhập nhầm không lan sang URL được sinh ra.
    return url.origin
  } catch {
    return getFallbackSiteUrl()
  }
}

export function getSiteUrl(): string {
  return normalizeSiteUrl(process.env.NEXTAUTH_URL)
}

export function getSiteHostname(): string {
  return new URL(getSiteUrl()).hostname.toLowerCase()
}

export function getSiteName(): string {
  return process.env.SITE_NAME?.trim() || getSiteHostname()
}

export function buildSiteUrl(pathname = '/'): string {
  return new URL(pathname, `${getSiteUrl()}/`).toString()
}

export function buildShortUrl(shortCode: string): string {
  return buildSiteUrl(`/${shortCode}`)
}

export function getMainAppHostnames(): Set<string> {
  const primaryHostname = getSiteHostname()
  const aliases = (process.env.APP_ALLOWED_HOSTS || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)

  const hostnames = new Set([primaryHostname, ...aliases, 'localhost', '127.0.0.1'])

  // Bare domain và www dùng chung app; custom short-link domains không nằm trong set này.
  if (primaryHostname.startsWith('www.')) {
    hostnames.add(primaryHostname.slice(4))
  } else {
    hostnames.add(`www.${primaryHostname}`)
  }

  return hostnames
}

export function isMainAppHostname(hostname: string): boolean {
  return getMainAppHostnames().has(hostname.split(':')[0].toLowerCase())
}
