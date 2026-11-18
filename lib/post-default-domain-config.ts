import { prisma } from '@/lib/prisma'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { getSiteHostname, isMainAppHostname } from '@/lib/site-config'

export const SYSTEM_DEFAULT_POST_DOMAIN_KEY = 'system_default_post_domain'
export const DEFAULT_SYSTEM_POST_DOMAIN = 'ca33newss.xyz'

export type SystemDefaultPostDomainConfig = {
  defaultDomain: string
  updatedAt: string | null
  updatedBy: string | null
}

export function getAllowedSystemPostDomains(): Array<{
  domain: string
  kind: 'shared' | 'primary'
}> {
  const primary = getSiteHostname().toLowerCase()
  return [
    ...SHARED_DOMAINS.map((domain) => ({ domain: domain.toLowerCase(), kind: 'shared' as const })),
    { domain: primary, kind: 'primary' as const },
  ]
}

export function normalizeSystemDefaultPostDomain(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')

  const primary = getSiteHostname().toLowerCase()
  if (cleaned === 'primary') return primary

  if (isMainAppHostname(cleaned) && cleaned === primary) return primary
  if (SHARED_DOMAINS.includes(cleaned)) return cleaned

  throw new Error('Domain mặc định phải nằm trong danh sách domain hệ thống')
}

function fallbackDefaultDomain(): string {
  if (SHARED_DOMAINS.includes(DEFAULT_SYSTEM_POST_DOMAIN)) return DEFAULT_SYSTEM_POST_DOMAIN
  return SHARED_DOMAINS[0] || getSiteHostname().toLowerCase()
}

export async function getSystemDefaultPostDomain(): Promise<SystemDefaultPostDomainConfig> {
  const defaultValue = fallbackDefaultDomain()
  try {
    const row = await prisma?.appSetting?.findUnique?.({
      where: { key: SYSTEM_DEFAULT_POST_DOMAIN_KEY },
    })
    if (!row?.value) {
      return { defaultDomain: defaultValue, updatedAt: null, updatedBy: null }
    }
    const parsed = JSON.parse(row.value) as Partial<SystemDefaultPostDomainConfig>
    const validated =
      typeof parsed.defaultDomain === 'string'
        ? normalizeSystemDefaultPostDomain(parsed.defaultDomain)
        : defaultValue
    return {
      defaultDomain: validated,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : row.updatedAt.toISOString(),
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
    }
  } catch {
    return { defaultDomain: defaultValue, updatedAt: null, updatedBy: null }
  }
}

export async function saveSystemDefaultPostDomain(input: {
  defaultDomain: string
  updatedBy: string
}): Promise<SystemDefaultPostDomainConfig> {
  const normalized = normalizeSystemDefaultPostDomain(input.defaultDomain)
  const next: SystemDefaultPostDomainConfig = {
    defaultDomain: normalized,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  }

  await prisma.appSetting.upsert({
    where: { key: SYSTEM_DEFAULT_POST_DOMAIN_KEY },
    create: { key: SYSTEM_DEFAULT_POST_DOMAIN_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })

  return next
}
