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
