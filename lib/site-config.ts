const LOCAL_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(value: string | undefined): string {
  const rawValue = value?.trim()
  if (!rawValue) return LOCAL_SITE_URL

  const candidate = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return LOCAL_SITE_URL
    // Chỉ giữ origin để path/query nhập nhầm không lan sang URL được sinh ra.
    return url.origin
  } catch {
    return LOCAL_SITE_URL
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
