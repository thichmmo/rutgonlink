// Signed affiliate links can exceed a conventional 2048-character web URL.
// Keep one boundary for source URLs, platform URLs and resolver results.
export const MAX_POPUP_AFFILIATE_URL_LENGTH = 8192
export const POPUP_AFFILIATE_URL_TOO_LONG = `Link popup/affiliate không được vượt quá ${MAX_POPUP_AFFILIATE_URL_LENGTH} ký tự`
export const POPUP_AFFILIATE_URL_INVALID = 'Chỉ chấp nhận URL HTTP(S) hợp lệ, không chứa tài khoản hoặc mật khẩu'

export function isValidPopupAffiliateUrl(value: string) {
  if (value.length > MAX_POPUP_AFFILIATE_URL_LENGTH) return false
  try {
    const url = new URL(value)
    // Validate without serializing: signed query strings must remain untouched.
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
