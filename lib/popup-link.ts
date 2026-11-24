export type PopupLinkPlatform = 'SHOPEE' | 'TIKTOK'
export type PopupLinkOpenMode = 'new-tab' | 'anchor-new-tab' | 'anchor-same-tab' | 'same-tab'

const FACEBOOK_IN_APP_PATTERN = /fban|fbav|fbios|fb_iab|fb4a|fbandroid/i
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i
const TIKTOK_DEEP_LINK_LABEL = 'click_wap_p_product_detail_t_launch_pop_up_s_product_detail_e__f_product_detail_fp__fps_affiliate_links_rf_product_detail'
const SHOPEE_IOS_MARKET_SCHEMES: ReadonlyArray<readonly [domain: string, scheme: string]> = [
  ['shopee.vn', 'shopeevn'],
  ['shopee.co.th', 'shopeeth'],
  ['shopee.sg', 'shopeesg'],
  ['shopee.com.my', 'shopeemy'],
  ['shopee.ph', 'shopeeph'],
  ['shopee.co.id', 'shopeeid'],
]
const SHOPEE_IOS_SCHEME_PREFIX_PATTERN = /^shopee(?:vn|th|sg|my|ph|id):\/\/reactPath\?/i
const SHOPEE_IOS_FORWARDED_UTM_KEYS = ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term'] as const

export const TIKTOK_ANDROID_HOSTS = ['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com', 'shop.tiktok.com']
// Verified against live /.well-known/assetlinks.json for package com.shopee.vn (shp.ee/shope.ee return 404 and must redirect over HTTPS first).
export const SHOPEE_ANDROID_HOSTS = ['shopee.vn', 'www.shopee.vn', 'mall.shopee.vn', 's.shopee.vn', 'vn.shp.ee']
const ANDROID_DEVICE_UA_PATTERN = /android|(?:harmonyos|openharmony).*(?:mobile|phone|arkweb)/i
// OEM browsers (Samsung Internet, Xiaomi Mi Browser, OPPO/Realme HeyTap, Vivo, Huawei, UC, Firefox)
// and non-FB4A in-app webviews (FBLite, Zalo, Messenger, Instagram, Threads, Telegram, TikTok, LINE)
// suppress automatic https:// App Links or drop _blank windows unless wrapped in a scheme=https intent.
const ANDROID_OEM_BROWSER_PATTERN = /samsungbrowser|miuibrowser|heytapbrowser|oppobrowser|realmelink|vivobrowser|huaweibrowser|arkweb|ucbrowser|firefox\/|fblite|orca-android|messenger|instagram|barcelona|\bzalo\b|bytedancewebview|musical_ly|telegram-android|\bline\//i
// Exclude only legacy FB4A WebView (gated to Chrome when forceChromeAndroid is enabled) and Presto Opera Mini.
const ANDROID_SKIP_INTENT_PATTERN = /fban\/fb4a|fb_iab\/fb4a|opera mini\//i
const MAX_ANDROID_LAUNCH_URL_LENGTH = 8192

export function isAndroidDeviceUserAgent(userAgent: string) {
  return ANDROID_DEVICE_UA_PATTERN.test(userAgent)
}

export function isAndroidOemBrowserUserAgent(userAgent: string) {
  return isAndroidDeviceUserAgent(userAgent) && ANDROID_OEM_BROWSER_PATTERN.test(userAgent)
}

export function isAndroidIntentBrowserUserAgent(userAgent: string) {
  return isAndroidDeviceUserAgent(userAgent) && !ANDROID_SKIP_INTENT_PATTERN.test(userAgent)
}

function parseSafeHttpsAppUrl(value: string, allowedHosts: readonly string[]) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
      || !allowedHosts.includes(parsed.hostname.toLowerCase())
      || value.length > MAX_ANDROID_LAUNCH_URL_LENGTH
      || !value.startsWith('https://') || /[#\s\\]/.test(value)) return null
    // Reject malformed UTF-16 before intent encoding rather than throwing on tap.
    encodeURIComponent(value)
    return parsed
  } catch {
    return null
  }
}

function parseAndroidTikTokUrl(value: string) {
  return parseSafeHttpsAppUrl(value, TIKTOK_ANDROID_HOSTS)
}

export function buildAndroidHttpsAppIntentUrl(value: string, allowedHosts: readonly string[], packageName: string) {
  if (!parseSafeHttpsAppUrl(value, allowedHosts)) return value
  // Pass the exact unmodified HTTPS URL via scheme=https so OEM browsers invoke Android's native app
  // handler without guessing custom schemes, and fall back to the original web URL when uninstalled.
  const result = `intent://${value.slice('https://'.length)}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${packageName};S.browser_fallback_url=${encodeURIComponent(value)};end`
  return result.length <= MAX_ANDROID_LAUNCH_URL_LENGTH ? result : value
}

export function buildTikTokAndroidLaunchUrl(productUrl: string, fallbackUrl = productUrl) {
  const parsed = parseAndroidTikTokUrl(productUrl)
  if (!parsed || !parseAndroidTikTokUrl(fallbackUrl)
    || !/\/(?:view\/product|pdp)\//.test(parsed.pathname)
    || !/\/\d{15,25}\/?$/.test(parsed.pathname)) return fallbackUrl

  // Match the native PDP link verified on the user's Android device. The signed
  // product is an opaque parameter: decoding params_url returns its exact bytes.
  const native = new URL('snssdk1180://ec/pdp')
  native.searchParams.set('biz_type', '0')
  native.searchParams.set('enter_method', 'web')
  native.searchParams.set('is_commerce', '1')
  native.searchParams.set('need_mall', '1')
  native.searchParams.set('needlaunchlog', '1')
  native.searchParams.set('page_name', 'reflow_pdp')
  native.searchParams.set('params_url', productUrl)
  const result = `intent://${native.toString().slice('snssdk1180://'.length)}#Intent;scheme=snssdk1180;package=com.ss.android.ugc.trill;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
  return result.length <= MAX_ANDROID_LAUNCH_URL_LENGTH ? result : fallbackUrl
}

export function getTikTokAndroidLaunchUrl(value: string, preparedLaunchUrl?: string) {
  if (typeof preparedLaunchUrl === 'string' && preparedLaunchUrl.startsWith('intent://ec/pdp?')) {
    try {
      const native = new URL(preparedLaunchUrl.replace(/^intent:/, 'snssdk1180:'))
      const productUrl = native.searchParams.get('params_url')
      // Derived metadata is accepted only if every field and the original-source
      // fallback match our builder; settings normalization drops it on all writes.
      if (productUrl && buildTikTokAndroidLaunchUrl(productUrl, value) === preparedLaunchUrl) return preparedLaunchUrl
    } catch { /* Invalid or stale metadata falls back to the original source. */ }
  }
  return buildTikTokAndroidLaunchUrl(value)
}

export function buildAndroidPopupLaunchUrl(value: string, platform: PopupLinkPlatform, userAgent = '') {
  // Omit userAgent only in legacy compatibility callers; active Android requests pass userAgent.
  if (!userAgent) return platform === 'SHOPEE' ? value : getTikTokAndroidLaunchUrl(value)
  // Standalone/OEM Android browsers (Chrome, Samsung, Xiaomi, OPPO, Vivo, Huawei/HarmonyOS, Firefox, UC)
  // and non-FB4A webviews invoke PackageManager directly via scheme=https intent:// with the exact
  // unmodified /opaanlp/ URL, while Referrer-Policy: no-referrer keeps EXTRA_REFERRER empty ("Others").
  if (!isAndroidIntentBrowserUserAgent(userAgent)) return value
  return platform === 'SHOPEE'
    ? buildAndroidHttpsAppIntentUrl(value, SHOPEE_ANDROID_HOSTS, 'com.shopee.vn')
    : buildAndroidHttpsAppIntentUrl(value, TIKTOK_ANDROID_HOSTS, 'com.ss.android.ugc.trill')
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

export function isTikTokIosRedirectUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port
      && ['tiktokv.com', 'www.tiktokv.com'].includes(parsed.hostname.toLowerCase())
      && parsed.pathname.startsWith('/redirect')
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

function parseTikTokProductDeepLink(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !TIKTOK_HOST_PATTERN.test(parsed.hostname)) return null
  if (!parsed.pathname.includes('/view/product/') && !parsed.pathname.includes('/pdp/')) return null
  const productId = parsed.pathname.match(/\/(\d{15,25})\/?$/)?.[1]
  if (!productId) return null

  const requestParams = JSON.stringify({ product_id: [productId] })
  const trackParams = parsed.searchParams.get('trackParams') || JSON.stringify({
    enable_shop_tab_popup: 1,
    traffic_source_list: [3],
    traffic_source: 3,
  })

  // Keep the original affiliate URL inside TikTok's product deep link, not the reference site's tracking.
  const deepLink = new URL('snssdk1180://ec/pdp')
  deepLink.searchParams.set('biz_type', '0')
  deepLink.searchParams.set('gd_label', TIKTOK_DEEP_LINK_LABEL)
  deepLink.searchParams.set('need_mall', '1')
  deepLink.searchParams.set('needlaunchlog', '1')
  deepLink.searchParams.set('page_name', 'reflow_pdp')
  deepLink.searchParams.set('params_url', value)
  deepLink.searchParams.set('refer', 'web')
  deepLink.searchParams.set('requestParams', requestParams)
  deepLink.searchParams.set('trackParams', trackParams)
  return { deepLink, requestParams, trackParams }
}

export function buildTikTokOneLinkUrl(value: string) {
  if (isTikTokOneLinkUrl(value) || isTikTokIosRedirectUrl(value)) return value
  const parsed = parseTikTokProductDeepLink(value)
  if (!parsed) return value

  // snssdk1180.onelink.me AASA registers "/BAuo/*", requiring the trailing slash;
  // af_force_deeplink prevents a 301 fallback to the regional App Store.
  const oneLink = new URL('https://snssdk1180.onelink.me/BAuo/')
  oneLink.searchParams.set('domain_source', 'tiktok')
  oneLink.searchParams.set('af_dp', parsed.deepLink.toString())
  oneLink.searchParams.set('af_force_deeplink', 'true')
  oneLink.searchParams.set('refer', 'web')
  oneLink.searchParams.set('requestParams', parsed.requestParams)
  oneLink.searchParams.set('trackParams', parsed.trackParams)
  const result = oneLink.toString()
  return result.length <= 8192 ? result : value
}

export function buildTikTokIosLaunchUrl(value: string) {
  if (isTikTokOneLinkUrl(value) || isTikTokIosRedirectUrl(value)) return value
  const parsed = parseTikTokProductDeepLink(value)
  if (!parsed) return value

  // Use TikTok's first-party Universal Link endpoint (/redirect* on www.tiktokv.com)
  // with the signed product URL as HTTP fallback so Facebook iOS never warns on onelink.me.
  const redirect = new URL('https://www.tiktokv.com/redirect/')
  redirect.searchParams.set('redirect_url', parsed.deepLink.toString())
  redirect.searchParams.set('dl', value)
  redirect.searchParams.set('ug_source', 'Facebook')
  redirect.searchParams.set('decode_once', '1')
  const result = redirect.toString()
  return result.length <= 8192 ? result : buildTikTokOneLinkUrl(value)
}

export function getTikTokIosLaunchUrl(value: string, userAgent: string) {
  // Wrap product URLs into TikTok's first-party Universal Link across all iOS browsers.
  return isIosUserAgent(userAgent)
    ? buildTikTokIosLaunchUrl(value)
    : value
}

export function isShopeeIosDeepLinkUrl(value: string) {
  return SHOPEE_IOS_SCHEME_PREFIX_PATTERN.test(value)
}

function resolveShopeeIosMarketScheme(hostname: string) {
  const host = hostname.toLowerCase()
  if (/^s\.shopee\./i.test(host)) return null
  for (const [domain, scheme] of SHOPEE_IOS_MARKET_SCHEMES) {
    if (host === domain || host === `www.${domain}` || host === `mall.${domain}`) return scheme
  }
  return null
}

export function buildShopeeIosLaunchUrl(value: string) {
  if (isShopeeIosDeepLinkUrl(value)) return value
  let parsed: URL
  try {
    parsed = new URL(value)
    encodeURIComponent(value)
  } catch {
    return value
  }
  const scheme = resolveShopeeIosMarketScheme(parsed.hostname)
  if (
    !scheme
    || parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || value.length > MAX_ANDROID_LAUNCH_URL_LENGTH
    || !value.startsWith('https://')
    || /[\s\\]/.test(value)
    || parsed.pathname === '/universal-link'
    || parsed.pathname.startsWith('/universal-link/')
    || parsed.pathname.includes('/login/')
    || parsed.pathname.includes('forgot_password')
    || parsed.pathname.startsWith('/buyer/w/')
    || parsed.pathname.includes('/verify/ivs/')
    || parsed.pathname.startsWith('/s/browser/')
  ) {
    return value
  }

  // Match Shopee ULS CONFIG.deepLinkUrl 1:1 while preserving the exact unmodified /opaanlp/ URL in navigate_url.
  // Firing shopeevn://reactPath directly on a trusted _self <a> tap bypasses Facebook iOS 18.5+ Universal Link
  // suppression and swcd browser-pinned domains without s.shopee.vn's 3s referral redirect ("Others").
  const entries: Array<[string, string]> = [
    ['navigate_url', value],
    ['path', 'shopee/TRANSFER_PAGE'],
    ['tab', 'buy'],
  ]
  const ulsTrackId = parsed.searchParams.get('uls_trackid')
  if (ulsTrackId) entries.push(['uls_trackid', ulsTrackId])
  entries.push(['use_deeplink', '1'])
  for (const key of SHOPEE_IOS_FORWARDED_UTM_KEYS) {
    const paramValue = parsed.searchParams.get(key)
    if (paramValue) entries.push([key, paramValue])
  }
  entries.push(['version', '1'])
  const result = `${scheme}://reactPath?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
  return result.length <= MAX_ANDROID_LAUNCH_URL_LENGTH ? result : value
}

export function getShopeeIosLaunchUrl(value: string, userAgent: string) {
  return isIosUserAgent(userAgent)
    ? buildShopeeIosLaunchUrl(value)
    : value
}

export function isIosUserAgent(userAgent: string) {
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
  if (isAndroidDeviceUserAgent(options.userAgent)) {
    // Standalone/OEM Android browsers and explicit intent:// URIs navigate in _self to avoid blank orphan tabs
    // and popup blockers; legacy FB4A WebView (when forceChromeAndroid is off) opens raw HTTPS in _blank.
    if (isAndroidIntentBrowserUserAgent(options.userAgent) || value.startsWith('intent://')) return 'anchor-same-tab'
    return platform === 'SHOPEE' ? 'anchor-new-tab' : 'anchor-same-tab'
  }
  // On iOS (iPhone 15 & all iPhones/iPads in Facebook IAB, Messenger, Zalo, and Safari), target="_blank"
  // triggers WKUIDelegate.createWebViewWithConfiguration -> webView.load(request) (WKNavigationTypeOther),
  // which suppresses iOS Universal Links and strands visitors on shopee.vn/opaanlp. A visible _self <a> tap
  // preserves WKNavigationTypeLinkActivated so LSAppLink opens Shopee & TikTok natively while no-referrer
  // keeps configuration.referrerURL = nil ("Others").
  if (isIosUserAgent(options.userAgent)) {
    return 'anchor-same-tab'
  }
  return 'new-tab'
}
