export type VideoEmbed = { kind: 'iframe' | 'video'; url: string; title: string; portrait?: boolean }

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const IFRAME_HOSTS = ['www.youtube-nocookie.com', 'www.youtube.com', 'player.vimeo.com', 'www.tiktok.com', 'www.facebook.com', 'www.instagram.com', 'drive.google.com']

function startTime(value: string | null) {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const parts = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : 0
}

// Parse the URL only; pasted iframe attributes and scripts are never trusted.
export function videoInputUrl(input: string) {
  const value = input.trim()
  if (!value.startsWith('<')) return value
  const src = value.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]
  return src?.replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&') || ''
}

export function normalizeVideoEmbedUrl(input: string): VideoEmbed | null {
  const value = videoInputUrl(input)
  if (/^\/uploads\/content\/[\w-]+\.(mp4|webm|ogv)$/i.test(value)) return { kind: 'video', url: value, title: 'Video' }
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  if (/\.(mp4|webm|ogv|ogg)$/i.test(url.pathname)) return { kind: 'video', url: url.href, title: 'Video' }

  if (YOUTUBE_HOSTS.has(host)) {
    const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
      : url.pathname === '/watch' ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)\/?$/)?.[1]
    if (!id || !/^[\w-]{11}$/.test(id)) return null
    const player = new URL('https://www.youtube-nocookie.com/embed/' + id)
    const start = startTime(url.searchParams.get('start') || url.searchParams.get('t'))
    if (start > 0) player.searchParams.set('start', String(start))
    return { kind: 'iframe', url: player.href, title: 'YouTube video' }
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/)
    if (!match) return null
    const player = new URL('https://player.vimeo.com/video/' + match[1])
    // Unlisted Vimeo videos require the privacy hash to survive normalization.
    const hash = url.searchParams.get('h') || match[2]
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) player.searchParams.set('h', hash)
    return { kind: 'iframe', url: player.href, title: 'Vimeo video' }
  }

  if (['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'].includes(host)) {
    const id = url.pathname.match(/^\/(?:@[^/]+\/video|player\/v1|embed\/v2)\/(\d+)\/?$/)?.[1]
    return id ? { kind: 'iframe', url: 'https://www.tiktok.com/player/v1/' + id + '?lang=vi-VN', title: 'TikTok video', portrait: true } : null
  }

  if (['www.facebook.com', 'facebook.com', 'm.facebook.com', 'web.facebook.com'].includes(host)) {
    if (url.pathname === '/plugins/video.php') {
      const href = url.searchParams.get('href')
      return href && !href.includes('/plugins/') ? normalizeVideoEmbedUrl(href) : null
    }
    if (!/^\/(?:watch\/?|reel\/\d+\/?|[^/]+\/videos\/(?:[^/]+\/)?\d+\/?|share\/v\/[^/]+\/?)$/.test(url.pathname)) return null
    if (/^\/watch/.test(url.pathname) && !/^\d+$/.test(url.searchParams.get('v') || '')) return null
    url.hostname = 'www.facebook.com'
    return { kind: 'iframe', url: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url.href) + '&show_text=false&width=560', title: 'Facebook video' }
  }

  if (['www.instagram.com', 'instagram.com'].includes(host)) {
    const match = url.pathname.match(/^\/(reel|p|tv)\/([\w-]+)(?:\/embed)?\/?$/)
    return match ? { kind: 'iframe', url: 'https://www.instagram.com/' + match[1] + '/' + match[2] + '/embed/', title: 'Instagram video', portrait: true } : null
  }

  if (host === 'drive.google.com') {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)\/?$/)?.[1]
    return id ? { kind: 'iframe', url: 'https://drive.google.com/file/d/' + id + '/preview', title: 'Google Drive video' } : null
  }
  return null
}

export function getAllowedIframeHostnames() { return IFRAME_HOSTS }

export function videoEmbedHtml(embed: VideoEmbed) {
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const media = embed.kind === 'video'
    ? '<video controls preload="metadata" playsinline src="' + escape(embed.url) + '"></video>'
    : '<iframe src="' + escape(embed.url) + '" title="' + escape(embed.title) + '" width="' + (embed.portrait ? 360 : 560) + '" height="' + (embed.portrait ? 640 : 315) + '" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'
  return '<figure class="video-embed' + (embed.portrait ? ' video-portrait' : '') + '">' + media + '</figure><p><br></p>'
}

// One stylesheet for the editor, React article and standalone custom-domain article.
export const MANAGED_MEDIA_CSS = '.managed-rich-content img{max-width:100%;height:auto}.managed-rich-content .video-embed{margin:1rem auto;max-width:100%;width:100%}.managed-rich-content iframe{display:block;width:100%;aspect-ratio:16/9;height:auto;border:0;border-radius:12px}.managed-rich-content iframe[src*="tiktok.com/player/"],.managed-rich-content iframe[src*="instagram.com/"]{aspect-ratio:9/16;max-width:380px;margin:auto}.managed-rich-content video{display:block;width:100%;max-width:100%;height:auto;background:#000;border-radius:12px}'

