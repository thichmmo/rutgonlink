import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  extractFacebookHandoffToken,
  hasFacebookClickId,
  isFacebookReferer,
  isFacebookUserAgent,
  type SearchParamsInput,
} from '@/lib/traffic-source'

type HandoffClaims = { kind: 'fbh'; host: string; expires: number }

// Keep signed Chrome/system-browser handoff valid across background app round trips and reloads.
export const FACEBOOK_HANDOFF_TTL_MS = 2 * 60 * 60 * 1000

function normalizeHost(host: string) {
  return new URL(`https://${host.trim().split(':')[0]}`).hostname.toLowerCase().replace(/\.$/, '')
}

function handoffSecret() {
  return process.env.NEXTAUTH_SECRET || 'popup-facebook-handoff-default-secret'
}

function signPayload(payload: string) {
  return createHmac('sha256', handoffSecret()).update(payload).digest('base64url')
}

export function createFacebookHandoffToken(host: string, now = Date.now()) {
  const claims: HandoffClaims = {
    kind: 'fbh',
    host: normalizeHost(host),
    expires: now + FACEBOOK_HANDOFF_TTL_MS,
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${signPayload(payload)}`
}

export function verifyFacebookHandoffToken(token: string | null | undefined, host: string, now = Date.now()) {
  if (!token || typeof token !== 'string') return false
  try {
    const [payload, mac, extra] = token.split('.')
    if (!payload || !mac || extra) return false
    const expected = Buffer.from(signPayload(payload))
    const actual = Buffer.from(mac)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as HandoffClaims
    return claims.kind === 'fbh'
      && claims.host === normalizeHost(host)
      && Number.isFinite(claims.expires)
      && claims.expires > now
  } catch {
    return false
  }
}

export function isServerFacebookTrafficSource(input: {
  userAgent?: string | null
  referer?: string | null
  url?: SearchParamsInput
  host?: string | null
  now?: number
}): boolean {
  if (isFacebookUserAgent(input.userAgent) || isFacebookReferer(input.referer) || hasFacebookClickId(input.url)) {
    return true
  }
  const token = extractFacebookHandoffToken(input.url)
  return Boolean(token && input.host && verifyFacebookHandoffToken(token, input.host, input.now))
}
