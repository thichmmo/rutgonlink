import { createHmac, timingSafeEqual } from 'node:crypto'

type Claims = { postId: string; popupId: string; host: string; expires: number }

function normalizeHost(host: string) {
  return new URL(`https://${host.trim()}`).hostname.toLowerCase().replace(/\.$/, '')
}

function signature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for popup click tracking')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createPopupClickToken(postId: string, popupId: string, host: string, now = Date.now()) {
  const claims: Claims = { postId, popupId, host: normalizeHost(host), expires: now + 86400000 }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifyPopupClickToken(token: string, postId: string, popupId: string, host: string, now = Date.now()) {
  try {
    const [payload, mac, extra] = token.split('.')
    if (!payload || !mac || extra) return false
    const expected = Buffer.from(signature(payload))
    const actual = Buffer.from(mac)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
    const claims: Claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return claims.postId === postId && claims.popupId === popupId && claims.host === normalizeHost(host)
      && Number.isFinite(claims.expires) && claims.expires > now
  } catch { return false }
}
