import { isAndroidUserAgent, popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'

// Cover Facebook/Lite/Messenger, Instagram, Threads (Barcelona), Zalo, TikTok, Telegram, and LINE Android webviews.
export const ANDROID_IN_APP_WEBVIEW_PATTERN = /fban|fbav|fbios|fb_iab|fb4a|fbandroid|orca-android|messenger|instagram|barcelona|\bzalo\b|bytedancewebview|musical_ly|telegram-android|\bline\//i

export function shouldGatePopupToChrome(settings: PopupSettings, userAgent: string) {
  return settings.forceChromeAndroid
    && isAndroidUserAgent(userAgent)
    && ANDROID_IN_APP_WEBVIEW_PATTERN.test(userAgent)
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

// Keep this function self-contained: the standalone renderer embeds its source.
export function buildSystemBrowserLaunchUrl(currentArticleUrl: string) {
  try {
    const url = new URL(currentArticleUrl)
    if (!/^https?:$/.test(url.protocol) || !url.host || url.username || url.password) return ''
    // Omit package= so Huawei/China-ROM/disabled-Chrome devices open their installed default system browser.
    const article = url.href.slice(url.protocol.length + 2)
    return `intent://${article}#Intent;scheme=${url.protocol.slice(0, -1)};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`
  } catch {
    return ''
  }
}
