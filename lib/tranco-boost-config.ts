import { prisma } from '@/lib/prisma'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { isMainAppHostname } from '@/lib/site-config'

export const SYSTEM_TRANCO_BOOST_KEY = 'system_tranco_boost'
export const DEFAULT_TRANCO_BOOST_DOMAINS = ['honghotngay228.site'] as const

const HOSTNAME_REGEX = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const CACHE_TTL_MS = 5_000

export type TrancoBoostConfig = {
  enabled: boolean
  domains: string[]
  updatedAt: string | null
  updatedBy: string | null
}

export type TrancoPingTarget = {
  domain: string
  beaconBaseUrl: string
}

let cachedConfig: { expiresAt: number; value: TrancoBoostConfig } | null = null

export function clearTrancoBoostCache() {
  cachedConfig = null
}

export function normalizeTrancoDomain(raw: string): string {
  let cleaned = raw.trim().toLowerCase()
  if (!cleaned) return ''
  if (/^https?:\/\//.test(cleaned)) {
    try {
      cleaned = new URL(cleaned).hostname.toLowerCase()
    } catch {
      throw new Error(`Tên miền không hợp lệ: ${raw}`)
    }
  }
  cleaned = cleaned.replace(/\/.*$/, '').replace(/\.$/, '')
  if (!HOSTNAME_REGEX.test(cleaned)) {
    throw new Error(`Tên miền không hợp lệ: ${raw}`)
  }
  return cleaned
}

export function normalizeTrancoDomainList(items: string[]): string[] {
  const unique: string[] = []
  for (const item of items) {
    const normalized = normalizeTrancoDomain(item)
    if (!normalized || unique.includes(normalized)) continue
    unique.push(normalized)
    if (unique.length >= 10) break
  }
  return unique
}

export async function getTrancoBoostConfig(): Promise<TrancoBoostConfig> {
  const useCache = process.env.NODE_ENV === 'production'
  if (useCache && cachedConfig && cachedConfig.expiresAt > Date.now()) {
    return cachedConfig.value
  }

  let value: TrancoBoostConfig = {
    enabled: true,
    domains: [...DEFAULT_TRANCO_BOOST_DOMAINS],
    updatedAt: null,
    updatedBy: null,
  }

  try {
    const row = await prisma?.appSetting?.findUnique?.({
      where: { key: SYSTEM_TRANCO_BOOST_KEY },
    })
    if (row?.value) {
      const parsed = JSON.parse(row.value) as Partial<TrancoBoostConfig>
      const domains = Array.isArray(parsed.domains)
        ? parsed.domains
            .filter((item): item is string => typeof item === 'string')
            .map((item) => {
              try {
                return normalizeTrancoDomain(item)
              } catch {
                return ''
              }
            })
            .filter(Boolean)
        : [...DEFAULT_TRANCO_BOOST_DOMAINS]
      value = {
        enabled: parsed.enabled !== false && domains.length > 0,
        domains,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : row.updatedAt.toISOString(),
        updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
      }
    }
  } catch {
    // Keep built-in default active when running in isolated test harnesses without AppSetting.
  }

  if (useCache) {
    cachedConfig = { expiresAt: Date.now() + CACHE_TTL_MS, value }
  }
  return value
}

export async function saveTrancoBoostConfig(input: {
  enabled: boolean
  domains: string[]
  updatedBy: string
}): Promise<TrancoBoostConfig> {
  const domains = normalizeTrancoDomainList(input.domains)
  if (input.enabled && domains.length === 0) {
    throw new Error('Vui lòng thêm ít nhất 1 tên miền trước khi bật kéo Tranco Top-1M')
  }

  const next: TrancoBoostConfig = {
    enabled: Boolean(input.enabled) && domains.length > 0,
    domains,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  }

  await prisma.appSetting.upsert({
    where: { key: SYSTEM_TRANCO_BOOST_KEY },
    create: { key: SYSTEM_TRANCO_BOOST_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })
  clearTrancoBoostCache()
  return next
}

export function buildBeaconBaseUrlForDomain(domain: string): string {
  // Domains served by this Next.js app expose the 43-byte Edge-cached /t.gif pixel;
  // external sites (such as mesale.vn) use their Cloudflare-cached /favicon.ico.
  const isInternal = isMainAppHostname(domain) || SHARED_DOMAINS.includes(domain)
  return isInternal ? `https://${domain}/t.gif` : `https://${domain}/favicon.ico`
}

export async function resolveTrancoPingTargets(currentHostname: string): Promise<TrancoPingTarget[]> {
  const config = await getTrancoBoostConfig()
  if (!config.enabled || config.domains.length === 0) return []
  const normalizedCurrent = currentHostname.toLowerCase().replace(/\.$/, '')
  return config.domains
    .filter((domain) => domain !== normalizedCurrent)
    .map((domain) => ({
      domain,
      beaconBaseUrl: buildBeaconBaseUrlForDomain(domain),
    }))
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function buildTrancoHeadHintsHtml(targets: TrancoPingTarget[]): string {
  if (targets.length === 0) return ''
  return targets
    .map(
      ({ domain }) =>
        `<link rel="dns-prefetch" href="//${escapeAttr(domain)}"><link rel="preconnect" href="https://${escapeAttr(domain)}" crossorigin>`,
    )
    .join('')
}

export function buildTrancoIdleBeaconScript(targets: TrancoPingTarget[]): string {
  if (targets.length === 0) return ''
  const urlsJson = escapeInlineJson(targets.map((target) => target.beaconBaseUrl))
  // Use requestIdleCallback when present and fall back to a microtask (never setTimeout) so popup timer
  // invariants stay untouched while detached low-priority Image(1,1) beacons warm DNS at the Edge.
  return `<script>(()=>{const urls=${urlsJson};if(!urls.length||document.documentElement.hasAttribute("data-post-guard-blocked"))return;const fire=()=>{if(document.documentElement.hasAttribute("data-post-guard-blocked")||document.querySelector("[data-popup-browser-gate]")||typeof window.Image!=="function")return;const day=new Date().toISOString().slice(0,10).replace(/-/g,"");for(const base of urls){try{const img=new window.Image(1,1);img.referrerPolicy="no-referrer";img.decoding="async";if("fetchPriority" in img)img.fetchPriority="low";img.src=base+"?d="+day}catch(_){}}};const schedule=()=>{if(typeof window.requestIdleCallback==="function")window.requestIdleCallback(fire,{timeout:600});else Promise.resolve().then(fire)};if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule()})();</script>`
}
