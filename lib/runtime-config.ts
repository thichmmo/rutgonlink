import { prisma } from '@/lib/prisma'

const FB_TOKENS_KEY = 'fb_tokens'
const FB_TOKEN_KEY = 'facebook_app_token'
const FB_DEBUG_INTERVAL_KEY = 'fb_debug_interval_minutes'
const FB_DEBUG_INTERVAL_DEFAULT = 20
const FB_DEBUG_MIN_CLICKS_KEY = 'fb_debug_min_clicks_per_day'
const FB_SCRAPE_RETRY_DELAY_MS = 3000
const FB_SCRAPE_MAX_ATTEMPTS_WITH_TOKEN = 5
const FB_SCRAPE_MAX_ATTEMPTS_WITHOUT_TOKEN = 3
const FB_SCRAPE_RETRYABLE_ERROR_CODES = new Set([2, 100, 368])

function isRetryableFbScrapeError(errorCode: number | null | undefined) {
  return errorCode !== null && errorCode !== undefined && FB_SCRAPE_RETRYABLE_ERROR_CODES.has(errorCode)
}

function waitForFbScrapeRetry() {
  return new Promise((resolve) => setTimeout(resolve, FB_SCRAPE_RETRY_DELAY_MS))
}

// ─── Token type ───────────────────────────────────────────────────────────────

export interface FbToken {
  id: string
  label: string
  token: string
  addedAt: string
  status: 'live' | 'die' | 'unknown'
  lastChecked?: string
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function getFbTokens(): Promise<FbToken[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: FB_TOKENS_KEY } })
  if (row?.value) {
    try { return JSON.parse(row.value) as FbToken[] } catch { return [] }
  }
  // Migrate from legacy single-token key
  const legacy = await prisma.appSetting.findUnique({ where: { key: FB_TOKEN_KEY } })
  if (legacy?.value?.trim()) {
    return [{
      id: 'legacy',
      label: 'Token (cũ)',
      token: legacy.value.trim(),
      addedAt: legacy.updatedAt.toISOString(),
      status: 'unknown',
    }]
  }
  return []
}

async function saveFbTokens(tokens: FbToken[]) {
  const value = JSON.stringify(tokens)
  await prisma.appSetting.upsert({
    where: { key: FB_TOKENS_KEY },
    update: { value },
    create: { key: FB_TOKENS_KEY, value },
  })
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addFbToken(label: string, token: string): Promise<FbToken> {
  const all = await getFbTokens()
  const existing = all.filter(t => t.id !== 'legacy')
  const newToken: FbToken = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    label: label.trim() || `Token ${existing.length + 1}`,
    token: token.trim(),
    addedAt: new Date().toISOString(),
    status: 'unknown',
  }
  existing.push(newToken)
  await saveFbTokens(existing)
  return newToken
}

export async function addFbTokensBulk(lines: string[]): Promise<FbToken[]> {
  const all = await getFbTokens()
  const existing = all.filter(t => t.id !== 'legacy')
  const added: FbToken[] = []
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    let label = `Token ${existing.length + added.length + 1}`
    let tokenVal = trimmed
    // support "label:token" format
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0 && colonIdx < 40 && !trimmed.startsWith('EAA')) {
      label = trimmed.slice(0, colonIdx).trim()
      tokenVal = trimmed.slice(colonIdx + 1).trim()
    }
    if (!tokenVal) continue
    added.push({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36) + added.length,
      label,
      token: tokenVal,
      addedAt: new Date().toISOString(),
      status: 'unknown',
    })
  }
  await saveFbTokens([...existing, ...added])
  return added
}

export async function removeFbToken(id: string) {
  const tokens = await getFbTokens()
  await saveFbTokens(tokens.filter(t => t.id !== id))
}

export function maskToken(token: string): string {
  if (token.length <= 10) return '**********'
  return `${token.slice(0, 6)}...${token.slice(-4)}`
}

// ─── Live/Die check ───────────────────────────────────────────────────────────

async function verifyFbToken(token: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ fields: 'id', access_token: token })
    const res = await fetch(`https://graph.facebook.com/app?${q.toString()}`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    return res.ok && !data?.error
  } catch {
    return false
  }
}

export async function checkAllFbTokens(): Promise<FbToken[]> {
  const tokens = await getFbTokens()
  if (tokens.length === 0) return []
  const updated = await Promise.all(
    tokens.map(async (t) => {
      const live = await verifyFbToken(t.token)
      return { ...t, status: (live ? 'live' : 'die') as 'live' | 'die', lastChecked: new Date().toISOString() }
    })
  )
  await saveFbTokens(updated)
  return updated
}

export async function getLiveFbTokens(): Promise<FbToken[]> {
  const tokens = await getFbTokens()
  return tokens.filter(t => t.status !== 'die')
}

// ─── Token rotation (live-only, round-robin) ──────────────────────────────────

let _rrIndex = 0

export async function getNextFbToken(): Promise<string | null> {
  const tokens = await getFbTokens()
  const live = tokens.filter(t => t.status !== 'die')
  if (live.length === 0) return process.env.FACEBOOK_APP_TOKEN?.trim() || null
  const t = live[_rrIndex % live.length]
  _rrIndex++
  return t.token
}

// ─── Legacy API (used by /admin/facebook-token) ───────────────────────────────

export async function getFacebookAppToken(): Promise<string | null> {
  return getNextFbToken()
}

export async function setFacebookAppToken(token: string | null) {
  const value = token?.trim() || ''
  if (!value) {
    await prisma.appSetting.deleteMany({ where: { key: FB_TOKEN_KEY } })
    return
  }
  await prisma.appSetting.upsert({
    where: { key: FB_TOKEN_KEY },
    update: { value },
    create: { key: FB_TOKEN_KEY, value },
  })
}

export async function getFacebookTokenMasked() {
  const tokens = await getFbTokens()
  const live = tokens.filter(t => t.status !== 'die')
  if (live.length > 0) return { hasToken: true, masked: maskToken(live[0].token) }
  if (tokens.length > 0) return { hasToken: true, masked: maskToken(tokens[0].token) }
  const envToken = process.env.FACEBOOK_APP_TOKEN?.trim()
  if (envToken) return { hasToken: true, masked: maskToken(envToken) }
  return { hasToken: false, masked: null as string | null }
}

// ─── Interval ─────────────────────────────────────────────────────────────────

export async function getFbDebugIntervalMinutes(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: FB_DEBUG_INTERVAL_KEY } })
  const val = parseInt(row?.value || '', 10)
  if (!isNaN(val) && val >= 1) return val
  return FB_DEBUG_INTERVAL_DEFAULT
}

export async function setFbDebugIntervalMinutes(minutes: number) {
  const value = String(Math.max(1, Math.floor(minutes)))
  await prisma.appSetting.upsert({
    where: { key: FB_DEBUG_INTERVAL_KEY },
    update: { value },
    create: { key: FB_DEBUG_INTERVAL_KEY, value },
  })
}

// ─── Min clicks per day ───────────────────────────────────────────────────────

export async function getFbDebugMinClicksPerDay(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: FB_DEBUG_MIN_CLICKS_KEY } })
  const val = parseInt(row?.value || '', 10)
  return isNaN(val) || val < 0 ? 0 : val
}

export async function setFbDebugMinClicksPerDay(n: number) {
  const value = String(Math.max(0, Math.floor(n)))
  await prisma.appSetting.upsert({
    where: { key: FB_DEBUG_MIN_CLICKS_KEY },
    update: { value },
    create: { key: FB_DEBUG_MIN_CLICKS_KEY, value },
  })
}

// ─── FB Scrape ────────────────────────────────────────────────────────────────

export interface FbScrapeResult {
  ok: boolean
  usedToken: boolean
  attempts?: number
  title?: string | null
  description?: string | null
  image?: string | null
  message?: string
  errorCode?: number | null
  errorType?: string | null
  raw?: unknown
}

export async function triggerFbScrape(shortUrl: string, specificToken?: string): Promise<FbScrapeResult> {
  const token = specificToken !== undefined ? specificToken : await getNextFbToken()
  const graphUrl = 'https://graph.facebook.com/v21.0/'
  const scrapeBody = token
    ? `id=${encodeURIComponent(shortUrl)}&scrape=true&access_token=${token}`
    : `id=${encodeURIComponent(shortUrl)}&scrape=true`
  const maxAttempts = token ? FB_SCRAPE_MAX_ATTEMPTS_WITH_TOKEN : FB_SCRAPE_MAX_ATTEMPTS_WITHOUT_TOKEN

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(graphUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(scrapeBody).toString(),
        },
        body: scrapeBody,
      })
      const data = await res.json().catch(() => null)

      if (res.ok && !data?.error) {
        return {
          ok: true,
          usedToken: !!token,
          attempts: attempt,
          title: data?.title ?? null,
          description: data?.description ?? null,
          image: data?.image?.[0]?.url ?? null,
          raw: data,
        }
      }

      const errorCode = data?.error?.code ?? null
      if (attempt < maxAttempts && isRetryableFbScrapeError(errorCode)) {
        // Facebook can return code 100 while the scrape target is still settling; retry before recording failure.
        await waitForFbScrapeRetry()
        continue
      }

      return {
        ok: false,
        usedToken: !!token,
        attempts: attempt,
        message: data?.error?.message || 'FB scrape thất bại',
        errorCode,
        errorType: data?.error?.type ?? null,
        raw: data,
      }
    } catch {
      if (attempt < maxAttempts) {
        await waitForFbScrapeRetry()
        continue
      }
      return { ok: false, usedToken: !!token, attempts: attempt, message: 'Không thể kết nối Facebook Graph API' }
    }
  }

  return { ok: false, usedToken: !!token, attempts: maxAttempts, message: 'Không thể kết nối Facebook Graph API' }
}

// ─── Folder Rotation ──────────────────────────────────────────────────────────

const FOLDER_ROTATION_DEFAULT_KEY = 'folder_rotation_default_enabled'

export async function getFolderRotationDefaultEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: FOLDER_ROTATION_DEFAULT_KEY } })
  if (!row?.value) return false
  try {
    return JSON.parse(row.value) === true
  } catch {
    return false
  }
}

export async function setFolderRotationDefaultEnabled(enabled: boolean) {
  const value = JSON.stringify(enabled)
  await prisma.appSetting.upsert({
    where: { key: FOLDER_ROTATION_DEFAULT_KEY },
    update: { value },
    create: { key: FOLDER_ROTATION_DEFAULT_KEY, value },
  })
}
