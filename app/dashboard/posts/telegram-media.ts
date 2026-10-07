import { normalizeVideoEmbedUrl, videoEmbedHtml, type VideoEmbed } from '@/lib/video-embed'

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function quickMediaHtml(input: string, mimeType = '') {
  if (mimeType.startsWith('image/')) {
    if (!safeImageUrl(input)) return null
    return `<p><img src="${escapeHtml(input)}" alt="" /></p>`
  }
  const video = normalizeVideoEmbedUrl(input)
  return video ? videoEmbedHtml(video) : null
}

function safeImageUrl(input: string) {
  if (/^\/uploads\/content\/[\w-]+\.(png|jpe?g|webp|gif|avif)$/i.test(input)) return true
  try {
    const url = new URL(input)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

export function appendQuickMedia(content: string, format: string, html: string, replace: boolean) {
  // Preserve existing text when switching its representation to rich content.
  const original = format === 'plain' ? `<p>${escapeHtml(content).replace(/\r?\n/g, '<br>')}</p>` : content
  return { content: (replace || !content.trim() ? '' : original) + html, contentFormat: format === 'raw-html' ? 'raw-html' : 'rich' }
}

export function quickMediaTitle(fileName?: string) {
  const base = fileName?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? base.slice(0, 200) : 'Video Telegram'
}

export function quickMediaSlug(title: string, timestamp = Date.now()) {
  const suffix = timestamp.toString(36)
  const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // The API permits 190 characters including the uniqueness suffix.
  const base = normalized.slice(0, 190 - suffix.length - 1).replace(/-+$/, '') || 'bai-telegram'
  return `${base}-${suffix}`
}

export type TelegramMediaPreview = VideoEmbed | { kind: 'image'; url: string; title: string }

type MediaNode = { tag: string; start: number; openEnd: number; end: number; opening: string; parent: MediaNode | null }
export type TelegramMediaItem = { kind: 'image' | 'video' | 'iframe'; title: string; preview: TelegramMediaPreview | null; start: number; end: number }

function mediaNodes(content: string) {
  const nodes: MediaNode[] = []
  const stack: MediaNode[] = []
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const rawTags = new Set(['script', 'style', 'textarea', 'title', 'iframe'])
  // Keep original offsets/bytes, including signed source queries. A DOM rewrite
  // would normalize all unrelated HTML just to remove a single media element.
  const tags = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi
  let rawTag = ''
  for (const match of content.matchAll(tags)) {
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    const closing = /^<\//.test(match[0])
    if (rawTag && !(closing && tag === rawTag)) continue
    const end = match.index + match[0].length
    if (closing) {
      const index = stack.findLastIndex(node => node.tag === tag)
      if (index >= 0) { stack[index].end = end; stack.splice(index) }
      if (tag === rawTag) rawTag = ''
      continue
    }
    const node = { tag, start: match.index, openEnd: end, end, opening: match[0], parent: stack.at(-1) || null }
    nodes.push(node)
    if (!voidTags.has(tag) && !/\/\s*>$/.test(match[0])) {
      stack.push(node)
      if (rawTags.has(tag)) rawTag = tag
    }
  }
  return nodes
}

function sourceAttribute(opening: string) {
  const src = opening.match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  return (src?.[1] ?? src?.[2] ?? src?.[3] ?? '').replace(/&amp;/gi, '&').replace(/&#(?:0*38|x0*26);/gi, '&')
}

export function telegramMediaItems(content: string): TelegramMediaItem[] {
  const nodes = mediaNodes(content)
  const media = nodes.filter(node => ['iframe', 'video', 'img'].includes(node.tag) && !hasMediaAncestor(node))
  return media.map(node => {
    const kind = node.tag === 'img' ? 'image' : node.tag as 'video' | 'iframe'
    let source = sourceAttribute(node.opening)
    if (!source && node.tag === 'video') source = nodes.filter(item => item.tag === 'source' && item.parent === node).map(item => sourceAttribute(item.opening)).find(Boolean) || ''
    const preview = kind === 'image' ? safeImageUrl(source) ? { kind: 'image' as const, url: source, title: 'Ảnh bài viết' } : null : normalizeVideoEmbedUrl(source)
    let target = node
    let parent = node.parent
    // Remove empty dedicated sizing/figure wrappers, while retaining every bit
    // of surrounding article text and any other media in a mixed wrapper.
    while (parent && ['p', 'div', 'figure'].includes(parent.tag) && parent.end >= node.end && media.filter(item => item.start >= parent!.start && item.end <= parent!.end).length === 1) {
      const remainder = content.slice(parent.openEnd, node.start) + content.slice(node.end, parent.end).replace(/<\/[^>]+>\s*$/, '')
      if (remainder.replace(/<!--[\s\S]*?-->|<[^>]*>/g, '').trim() || /<(?:img|video|iframe|audio|input|button|hr|table|script|style|textarea|select|form|object|embed|svg)\b/i.test(remainder)) break
      target = parent
      parent = parent.parent
    }
    return { kind, title: preview?.title || (kind === 'image' ? 'Ảnh chưa có nguồn hợp lệ' : 'Video chưa có nguồn hợp lệ'), preview, start: target.start, end: target.end }
  })
}

function hasMediaAncestor(node: MediaNode) {
  let parent = node.parent
  while (parent) { if (['iframe', 'video'].includes(parent.tag)) return true; parent = parent.parent }
  return false
}

export function removeTelegramMedia(content: string, index: number) {
  const item = telegramMediaItems(content)[index]
  if (!item) return content
  const next = content.slice(0, item.start) + content.slice(item.end)
  // Empty insertion spacers are not remaining article content. Returning an
  // empty body lets the existing Telegram save validation request new media.
  const spacers = next.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(?:p|div|br)\b[^>]*>/gi, '').replace(/&nbsp;|&#160;/gi, '').trim()
  return !telegramMediaItems(next).length && !spacers ? '' : next
}

export function telegramMediaPreview(content: string): TelegramMediaPreview | null {
  // Preview only a validated media URL, never render arbitrary editor HTML here.
  const tags = content.match(/<(?:iframe|video|source|img)\b[^>]*>/gi) || []
  for (const tag of tags) {
    const src = tag.match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]?.replace(/&amp;/gi, '&')
    if (!src) continue
    if (/^<img\b/i.test(tag)) {
      if (safeImageUrl(src)) return { kind: 'image', url: src, title: 'Ảnh bài viết' }
    } else {
      const video = normalizeVideoEmbedUrl(src)
      if (video) return video
    }
  }
  return null
}
