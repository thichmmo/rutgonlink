import { isAndroidUserAgent, popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'

export function shouldGatePopupToChrome(settings: PopupSettings, userAgent: string) {
  return settings.forceChromeAndroid
    && isAndroidUserAgent(userAgent)
    && /fban|fbav|fbios|fb_iab|fb4a|fbandroid/i.test(userAgent)
    && popupAppliesToDevice(settings, userAgent)
    && Boolean((settings.tiktok.androidUrl || settings.tiktok.url).trim())
}

// Keep this function self-contained: the standalone renderer embeds its source.
export function buildChromeBrowserLaunchUrl(currentArticleUrl: string) {
  try {
    const url = new URL(currentArticleUrl)
    if (!/^https?:$/.test(url.protocol) || !url.host || url.username || url.password) return ''
    // Android parses the final #Intent delimiter, preserving an earlier article fragment.
    const article = url.href.slice(url.protocol.length + 2)
    return `intent://${article}#Intent;scheme=${url.protocol.slice(0, -1)};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end`
  } catch {
    return ''
  }
}
