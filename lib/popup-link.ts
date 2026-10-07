export type PopupLinkPlatform = 'SHOPEE' | 'TIKTOK'
export type PopupLinkOpenMode = 'new-tab' | 'anchor-new-tab' | 'anchor-same-tab' | 'same-tab'

const FACEBOOK_IN_APP_PATTERN = /fban|fbav|fbios|fb_iab|fb4a|fbandroid/i
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i
const TIKTOK_DEEP_LINK_LABEL = 'click_wap_p_product_detail_t_launch_pop_up_s_product_detail_e__f_product_detail_fp__fps_affiliate_links_rf_product_detail'

// These vendor hosts publish Android assetlinks. Unknown shorteners stay HTTPS.
const ANDROID_APP_HOSTS = {
  SHOPEE: ['shopee.vn', 'www.shopee.vn', 's.shopee.vn'],
  TIKTOK: ['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com', 'shop.tiktok.com'],
}

export function buildAndroidPopupLaunchUrl(value: string, platform: PopupLinkPlatform) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
      || !ANDROID_APP_HOSTS[platform].includes(parsed.hostname)
      || !value.startsWith('https://') || /[#\s\\]/.test(value)) return value
    // Keep the signed URL byte-for-byte; never rebuild query parameters with URLSearchParams.
    // Pin the vendor's Vietnam Android app; a package-less HTTPS intent can resolve
    // back to the browser instead of TikTok. Keep the source URL as the web fallback.
    const appPackage = platform === 'SHOPEE' ? 'package=com.shopee.vn;' : 'package=com.ss.android.ugc.trill;'
    return `intent://${value.slice('https://'.length)}#Intent;scheme=https;${appPackage}S.browser_fallback_url=${encodeURIComponent(value)};end`
  } catch {
    return value
  }
}

export function isTikTokOneLinkUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && (parsed.hostname === 'onelink.me' || parsed.hostname.endsWith('.onelink.me'))
  } catch {
    return false
  }
}

export function isTikTokShortUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.port && ['vt.tiktok.com', 'vm.tiktok.com'].includes(parsed.hostname)
  } catch {
    return false
  }
}

// Keep the original affiliate URL inside TikTok's product deep link, not the reference site's tracking.
export function buildTikTokOneLinkUrl(value: string) {
  if (isTikTokOneLinkUrl(value)) return value

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return value
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !TIKTOK_HOST_PATTERN.test(parsed.hostname)) return value
  if (!parsed.pathname.includes('/view/product/') && !parsed.pathname.includes('/pdp/')) return value
  const productId = parsed.pathname.match(/\/(\d{15,25})\/?$/)?.[1]
  if (!productId) return value

  const deepLink = new URL('snssdk1180://ec/pdp')
  deepLink.searchParams.set('biz_type', '0')
  deepLink.searchParams.set('gd_label', TIKTOK_DEEP_LINK_LABEL)
  deepLink.searchParams.set('need_mall', '1')
  deepLink.searchParams.set('needlaunchlog', '1')
  deepLink.searchParams.set('page_name', 'reflow_pdp')
  deepLink.searchParams.set('params_url', value)
  deepLink.searchParams.set('refer', 'web')
  deepLink.searchParams.set('requestParams', JSON.stringify({ product_id: [productId] }))
  deepLink.searchParams.set('trackParams', parsed.searchParams.get('trackParams') || JSON.stringify({
    enable_shop_tab_popup: 1,
    traffic_source_list: [3],
    traffic_source: 3,
  }))

  const oneLink = new URL('https://snssdk1180.onelink.me/BAuo')
  oneLink.searchParams.set('domain_source', 'tiktok')
  oneLink.searchParams.set('af_dp', deepLink.toString())
  const result = oneLink.toString()
  return result.length <= 8192 ? result : value
}

export function getTikTokIosLaunchUrl(value: string, userAgent: string) {
  return isIosFacebookUserAgent(userAgent)
    ? buildTikTokOneLinkUrl(value)
    : value
}

function isIosUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

function isFacebookInAppUserAgent(userAgent: string) {
  return FACEBOOK_IN_APP_PATTERN.test(userAgent)
}

export function isIosFacebookUserAgent(userAgent: string) {
  return isIosUserAgent(userAgent) && isFacebookInAppUserAgent(userAgent)
}

export function getPopupLinkOpenMode(
  value: string,
  platform: PopupLinkPlatform,
  options: { userAgent: string },
): PopupLinkOpenMode {
  if (/android/i.test(options.userAgent)) return 'anchor-same-tab'
  const isIosFacebook = isIosFacebookUserAgent(options.userAgent)

  // Let Facebook handle the link action before allocating a script-opened blank webview.
  if (isIosFacebook && platform === 'SHOPEE') return 'anchor-new-tab'

  // An unresolved short link must not fall back to a script-created Facebook tab.
  return isIosFacebook && platform === 'TIKTOK' && (isTikTokOneLinkUrl(value) || isTikTokShortUrl(value))
    ? 'same-tab'
    : 'new-tab'
}
