import { lookup } from 'node:dns/promises'
import { get as httpsGet } from 'node:https'
import ipaddr from 'ipaddr.js'
import sanitizeHtml from 'sanitize-html'

export const MAX_ARTICLE_VIDEO_URL_LENGTH = 8192
export const MAX_ARTICLE_HTML_BYTES = 500_000
export const ARTICLE_VIDEO_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const SOURCE_ATTRIBUTES = ['src', 'data-src', 'data-lazy-src']
const RAW_TAGS = new Set(['script', 'style', 'textarea', 'title', 'iframe', 'noscript', 'template', 'svg', 'math', 'xmp', 'noembed', 'noframes'])

export class ArticleVideoError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message)
    this.name = 'ArticleVideoError'
  }
}

export function parseArticleVideoUrl(value: string): URL | null {
  if (!value || value.length > MAX_ARTICLE_VIDEO_URL_LENGTH || /[\u0000-\u0020\u007f\\]/.test(value)) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null
  } catch { return null }
}

export function isPublicArticleAddress(address: string) {
  try { return ipaddr.parse(address).range() === 'unicast' } catch { return false }
}

function queryBytes(value: string) {
  const query = value.indexOf('?'), hash = value.indexOf('#')
  return query >= 0 && (hash < 0 || query < hash) ? value.slice(query, hash < 0 ? undefined : hash) : null
}

export function extractArticleVideoUrls(html: string, finalUrl: string): string[] {
  const sources: string[] = []
  const stack: string[] = []
  let rawDepth = 0, videoDepth = 0
  let plaintext = false
  let baseHref: string | undefined
  // Use the installed HTML parser without rendering its output or executing page
  // scripts. Raw-text/inert containers never contribute fake video/source tags.
  sanitizeHtml(html, {
    allowedTags: [], allowedAttributes: {}, parseStyleAttributes: false,
    onOpenTag: (name, attributes) => {
      if (!rawDepth && !plaintext) {
        if (name === 'base' && attributes.href !== undefined && baseHref === undefined) baseHref = attributes.href
        if (name === 'video' || (name === 'source' && videoDepth > 0)) {
          for (const attribute of SOURCE_ATTRIBUTES) if (attributes[attribute]) sources.push(attributes[attribute])
        }
      }
      stack.push(name)
      // Unlike other raw-text tags, plaintext cannot be closed in HTML.
      if (name === 'plaintext') plaintext = true
      if (RAW_TAGS.has(name)) rawDepth += 1
      if (name === 'video') videoDepth += 1
    },
    onCloseTag: name => {
      while (stack.length) {
        const closed = stack.pop()!
        if (RAW_TAGS.has(closed)) rawDepth -= 1
        if (closed === 'video') videoDepth -= 1
        if (closed === name) break
      }
    },
  })
  let base = finalUrl
  if (baseHref !== undefined) {
    try { base = new URL(baseHref, finalUrl).href } catch { /* Invalid base leaves the document URL in use. */ }
  }
  const found = new Set<string>()
  for (const source of sources) {
    const raw = source.trim()
    if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) continue
    let url: URL
    try { url = new URL(raw, base) } catch { continue }
    if (!parseArticleVideoUrl(url.href) || !/\.(?:mp4|webm|ogg|ogv)$/i.test(url.pathname)) continue
    // HTML entities are decoded once by the parser; signed query bytes must
    // survive URL resolution unchanged, including duplicate keys and '+' chars.
    const originalQuery = queryBytes(raw)
    if (originalQuery !== null && queryBytes(url.href) !== originalQuery) continue
    found.add(url.href)
  }
  return [...found]
}

function bounded<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

async function publicAddresses(url: URL, signal: AbortSignal) {
  signal.throwIfAborted()
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  // Node does not call custom lookup for literal IPs, so validate those directly.
  if (ipaddr.isValid(hostname)) {
    if (!isPublicArticleAddress(hostname)) throw new ArticleVideoError('URL không thuộc địa chỉ Internet công khai')
    return [{ address: hostname, family: ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6 }]
  }
  const addresses = await bounded(lookup(hostname, { all: true, verbatim: true }), signal)
  if (!addresses.length || addresses.some(item => !isPublicArticleAddress(item.address))) {
    throw new ArticleVideoError('URL không thuộc địa chỉ Internet công khai')
  }
  return addresses
}

type HtmlResponse = { location: string } | { html: string }

async function readArticle(url: URL, signal: AbortSignal): Promise<HtmlResponse> {
  const [address] = await publicAddresses(url, signal)
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => { if (!settled) { settled = true; reject(error) } }
    const finish = (result: HtmlResponse) => { if (!settled) { settled = true; resolve(result) } }
    // Pin the checked DNS result to the socket, and repeat validation on each hop.
    const request = httpsGet(url, {
      agent: false, family: address.family, signal,
      lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
      headers: { accept: 'text/html,application/xhtml+xml', 'accept-encoding': 'identity', 'user-agent': 'Mozilla/5.0 RutgonlinkVideoResolver/1.0' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
        finish({ location: response.headers.location })
        response.destroy()
        return
      }
      if (response.statusCode !== 200) {
        fail(new ArticleVideoError('Không tải được trang bài viết', 502)); response.destroy(); return
      }
      if (!/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(response.headers['content-type'] || '')) {
        fail(new ArticleVideoError('URL này không trả về trang HTML bài viết')); response.destroy(); return
      }
      if (Number(response.headers['content-length'] || 0) > MAX_ARTICLE_HTML_BYTES || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
        fail(new ArticleVideoError('Trang bài viết quá lớn hoặc không đọc được HTML')); response.destroy(); return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        if (settled) return
        size += chunk.length
        if (size > MAX_ARTICLE_HTML_BYTES) { fail(new ArticleVideoError('Trang bài viết quá lớn')); response.destroy(); return }
        chunks.push(chunk)
      })
      response.on('end', () => {
        if (settled) return
        if (!response.complete) fail(new ArticleVideoError('Trang bài viết tải chưa đầy đủ', 502))
        else finish({ html: Buffer.concat(chunks).toString('utf8') })
      })
      response.on('error', () => fail(new ArticleVideoError('Không đọc được trang bài viết', 502)))
      response.on('aborted', () => fail(new ArticleVideoError('Trang bài viết bị ngắt khi tải', 502)))
      response.on('close', () => { if (!response.complete) fail(new ArticleVideoError('Trang bài viết tải chưa đầy đủ', 502)) })
    })
    request.on('error', () => fail(new ArticleVideoError('Không kết nối được trang bài viết', 502)))
  })
}

export async function resolveArticleVideoUrl(input: string): Promise<string> {
  let current = parseArticleVideoUrl(input)
  if (!current) throw new ArticleVideoError('Vui lòng nhập URL bài viết HTTPS hợp lệ, không có tài khoản hoặc cổng riêng', 400)
  const signal = AbortSignal.timeout(ARTICLE_VIDEO_TIMEOUT_MS)
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await readArticle(current, signal)
      if ('location' in response) {
        if (redirects === MAX_REDIRECTS) throw new ArticleVideoError('Trang bài viết chuyển hướng quá nhiều lần')
        let redirected: URL
        try { redirected = new URL(response.location, current) } catch { throw new ArticleVideoError('Trang bài viết chuyển hướng đến URL không hợp lệ') }
        const validated = parseArticleVideoUrl(redirected.href)
        if (!validated) throw new ArticleVideoError('Trang bài viết chuyển hướng đến URL không hợp lệ')
        current = validated
        continue
      }
      const candidates = extractArticleVideoUrls(response.html, current.href)
      for (const candidate of candidates) {
        try {
          await publicAddresses(new URL(candidate), signal)
          return candidate
        } catch {
          signal.throwIfAborted()
          // Invalid/private or unavailable media hosts are skipped, never fetched.
        }
      }
      throw new ArticleVideoError('Không tìm thấy video MP4, WebM hoặc OGG trực tiếp trong bài viết. Bạn có thể dán link video trực tiếp.')
    }
    throw new ArticleVideoError('Trang bài viết chuyển hướng quá nhiều lần')
  } catch (error) {
    if (signal.aborted) throw new ArticleVideoError('Hết thời gian lấy video từ bài viết. Vui lòng thử lại.', 504)
    if (error instanceof ArticleVideoError) throw error
    throw new ArticleVideoError('Không lấy được video từ bài viết. Vui lòng thử lại.', 502)
  }
}
