import { normalizeTelegramSettings } from '@/lib/telegram-settings'
import { getSiteUrl } from '@/lib/site-config'

function escape(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

// Shared HTML keeps React aliases and standalone share domains visually identical.
// Settings are plain text, never author-supplied HTML or scripts.
export function renderTelegramHeader(value: unknown): string {
  const settings = normalizeTelegramSettings(value)
  if (!settings.enabled) return ''
  return `<section class="telegram-intro"><div class="telegram-cta-wrap"><a class="telegram-cta" href="${escape(settings.url)}" target="_blank" rel="noopener noreferrer">${escape(settings.buttonText)}</a></div>${settings.disclaimer ? `<p class="telegram-disclaimer">${escape(settings.disclaimer)}</p>` : ''}</section>`
}

export function renderTelegramFooter(): string {
  // Share domains may only proxy public posts, so policy links use the main origin.
  return `<footer class="telegram-policy"><a href="${escape(getSiteUrl())}/chinh-sach-bao-mat" target="_blank" rel="noopener noreferrer">Chính sách bảo mật</a></footer>`
}

export const TELEGRAM_POST_CSS = `
.telegram-post-page{min-height:100vh;background:#fff;color:#111827;font:16px/1.7 Arial,system-ui,sans-serif}
.telegram-post{max-width:800px;margin:0 auto;padding:1px 12px 40px;overflow-wrap:anywhere}
.telegram-cta-wrap{text-align:center;margin:25px 0}
.telegram-post .telegram-cta{display:inline-block;max-width:100%;background:#229ED9;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:18px;font-weight:700;line-height:1.5;box-shadow:0 3px 10px rgba(0,0,0,.2)}
.telegram-cta:focus-visible{outline:3px solid #075985;outline-offset:4px}
.telegram-disclaimer{margin:0 0 20px;white-space:pre-wrap;line-height:1.6}
.telegram-post .managed-rich-content{font-size:16px;line-height:1.7}
.telegram-post .managed-rich-content p{margin:0 0 12px}
.telegram-post .managed-rich-content img,.telegram-post .managed-rich-content video,.telegram-post .managed-rich-content iframe{display:block;width:100%;max-width:100%;margin:14px auto;border-radius:16px;box-shadow:0 10px 28px rgba(2,8,23,.22)}
.telegram-post .managed-rich-content img,.telegram-post .managed-rich-content video{height:auto}
.telegram-post .managed-rich-content iframe{aspect-ratio:16/9;height:auto;border:0}
.telegram-post .managed-rich-content .video-portrait iframe{aspect-ratio:9/16;max-width:380px}
.telegram-policy{margin:12px 0 0;font-size:16px;line-height:1.5}
.telegram-policy a{color:#0f5bd7;text-decoration:underline;text-underline-offset:3px}
`
