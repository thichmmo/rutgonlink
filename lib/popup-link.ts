export type PopupLinkPlatform = 'SHOPEE' | 'TIKTOK'
export type PopupLinkOpenMode = 'new-tab' | 'anchor-new-tab' | 'same-tab'

const FACEBOOK_IN_APP_PATTERN = /fban|fbav|fbios|fb_iab|fb4a|fbandroid/i
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i
const TIKTOK_DEEP_LINK_LABEL = 'click_wap_p_product_detail_t_launch_pop_up_s_product_detail_e__f_product_detail_fp__fps_affiliate_links_rf_product_detail'

export function isTikTokOneLinkUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && (parsed.hostname === 'onelink.me' || parsed.hostname.endsWith('.onelink.me'))
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
  return isIosUserAgent(userAgent) && isFacebookInAppUserAgent(userAgent)
    ? buildTikTokOneLinkUrl(value)
    : value
}

function isIosUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

function isFacebookInAppUserAgent(userAgent: string) {
  return FACEBOOK_IN_APP_PATTERN.test(userAgent)
}

export function getPopupLinkOpenMode(
  value: string,
  platform: PopupLinkPlatform,
  options: { userAgent: string },
): PopupLinkOpenMode {
  const isIosFacebook = isIosUserAgent(options.userAgent)
    && isFacebookInAppUserAgent(options.userAgent)

  // Let Facebook handle the link action before allocating a script-opened blank webview.
  if (isIosFacebook && platform === 'SHOPEE') return 'anchor-new-tab'

  return isIosFacebook && platform === 'TIKTOK' && isTikTokOneLinkUrl(value)
    ? 'same-tab'
    : 'new-tab'
}
