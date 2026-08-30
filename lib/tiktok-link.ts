const TIKTOK_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ' +
  'AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

const MAX_REDIRECTS = 10

export interface TikTokLinkResult {
  shortUrl: string
  officialUrl: string
  convertedUrl: string
  productId: string
  title: string | null
}

export class TikTokLinkError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'TikTokLinkError'
  }
}

function isTikTokHost(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === 'tiktok.com' || normalized.endsWith('.tiktok.com')
}

function isShortTikTokHost(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === 'vt.tiktok.com' || normalized === 'vm.tiktok.com'
}

function parseTikTokUrl(value: string) {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new TikTokLinkError('Link TikTok không hợp lệ')
  }

  if (parsed.protocol !== 'https:' || !isTikTokHost(parsed.hostname)) {
    throw new TikTokLinkError('Chỉ chấp nhận link HTTPS thuộc TikTok')
  }

  return parsed
}

async function discardResponseBody(response: Response) {
  if (!response.body) return

  try {
    await response.body.cancel()
  } catch {
    // Headers and redirect location are already available; body cleanup is best-effort.
  }
}

export async function resolveTikTokUrl(inputUrl: string) {
  let currentUrl = parseTikTokUrl(inputUrl).href

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response: Response

    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'user-agent': TIKTOK_USER_AGENT,
        },
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'TikTok phản hồi quá chậm, vui lòng thử lại'
        : 'Không thể kết nối tới TikTok'
      throw new TikTokLinkError(message, 502)
    }

    const location = response.headers.get('location')
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status)
    await discardResponseBody(response)

    if (isRedirect && location) {
      const nextUrl = new URL(location, currentUrl)
      if (nextUrl.protocol !== 'https:' || !isTikTokHost(nextUrl.hostname)) {
        throw new TikTokLinkError('TikTok chuyển hướng tới domain không hợp lệ', 502)
      }

      currentUrl = nextUrl.href
      continue
    }

    const finalUrl = parseTikTokUrl(currentUrl)
    if (isShortTikTokHost(finalUrl.hostname)) {
      throw new TikTokLinkError('TikTok chưa trả về link sản phẩm đầy đủ', 502)
    }

    return currentUrl
  }

  throw new TikTokLinkError('Link TikTok chuyển hướng quá nhiều lần', 502)
}

function extractProductTitle(finalUrl: string) {
  try {
    const ogInfo = new URL(finalUrl).searchParams.get('og_info')
    if (!ogInfo) return null

    const parsed = JSON.parse(ogInfo) as { title?: unknown }
    return typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : null
  } catch {
    return null
  }
}

export function convertTikTokProductUrl(shortUrl: string, officialUrl: string): TikTokLinkResult {
  const queryIndex = officialUrl.indexOf('?')
  const rawQuery = queryIndex >= 0 ? officialUrl.slice(queryIndex) : ''
  const urlWithoutQuery = queryIndex >= 0 ? officialUrl.slice(0, queryIndex) : officialUrl
  const parsed = parseTikTokUrl(urlWithoutQuery)

  const isProductPath = parsed.pathname.includes('/pdp/') || parsed.pathname.includes('/view/product/')
  const productIdMatch = parsed.pathname.match(/\/(\d{15,25})\/?$/)

  if (!isProductPath || !productIdMatch) {
    throw new TikTokLinkError('Link không trỏ tới sản phẩm TikTok Shop')
  }

  const productId = productIdMatch[1]

  // Preserve the raw query byte-for-byte because it may contain signed affiliate payloads.
  const convertedUrl = `https://www.tiktok.com/view/product/${productId}${rawQuery}`

  return {
    shortUrl,
    officialUrl,
    convertedUrl,
    productId,
    title: extractProductTitle(officialUrl),
  }
}

export async function expandAndConvertTikTokLink(inputUrl: string) {
  const normalizedInput = parseTikTokUrl(inputUrl).href
  const officialUrl = await resolveTikTokUrl(normalizedInput)
  return convertTikTokProductUrl(normalizedInput, officialUrl)
}
