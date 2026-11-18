import { prisma } from '@/lib/prisma'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { getSiteHostname, isMainAppHostname } from '@/lib/site-config'
import { getPublicPostPath, numericPostSlug } from '@/lib/public-post-link'

export const SYSTEM_POST_FALLBACK_KEY = 'system_post_fallback'

export type SystemPostFallbackConfig = {
  enabled: boolean
  targetUrl: string
  updatedAt: string | null
  updatedBy: string | null
}

const DEFAULT_CONFIG: SystemPostFallbackConfig = {
  enabled: false,
  targetUrl: '',
  updatedAt: null,
  updatedBy: null,
}

const RESERVED_SINGLE_SEGMENTS = new Set([
  'admin',
  'api',
  'blog',
  'chinh-sach-bao-mat',
  'dashboard',
  'dieu-khoan',
  'forgot-password',
  'lien-he',
  'login',
  'p',
  'p7',
  'posts',
  'pricing',
  'register',
  'reset-password',
  'robots.txt',
])

export function normalizeFallbackTargetUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''

  const defaultHost = SHARED_DOMAINS[0] || getSiteHostname()
  const expanded =
    trimmed.startsWith('/p7/') || trimmed.startsWith('/posts/')
      ? `https://${defaultHost}${trimmed}`
      : /^p7\/[1-9]\d{4}\/?$/.test(trimmed)
        ? `https://${defaultHost}/${trimmed}`
        : trimmed

  let parsed: URL
  try {
    parsed = new URL(expanded)
  } catch {
    throw new Error('URL đích không hợp lệ (hãy nhập https://... hoặc /p7/mã-số)')
  }

  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
    throw new Error('URL đích chỉ hỗ trợ giao thức http:// hoặc https://')
  }

  return parsed.toString()
}

export async function getSystemPostFallbackConfig(): Promise<SystemPostFallbackConfig> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SYSTEM_POST_FALLBACK_KEY },
  })
  if (!row?.value) return { ...DEFAULT_CONFIG }

  try {
    const parsed = JSON.parse(row.value) as Partial<SystemPostFallbackConfig>
    const targetUrl = typeof parsed.targetUrl === 'string' ? parsed.targetUrl.trim() : ''
    return {
      enabled: Boolean(parsed.enabled) && Boolean(targetUrl),
      targetUrl,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : row.updatedAt.toISOString(),
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveSystemPostFallbackConfig(input: {
  enabled: boolean
  targetUrl: string
  updatedBy: string
}): Promise<SystemPostFallbackConfig> {
  const normalizedUrl = normalizeFallbackTargetUrl(input.targetUrl)
  if (input.enabled && !normalizedUrl) {
    throw new Error('Vui lòng nhập URL đích trước khi bật hứng link bài viết cũ')
  }

  const next: SystemPostFallbackConfig = {
    enabled: Boolean(input.enabled),
    targetUrl: normalizedUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  }

  await prisma.appSetting.upsert({
    where: { key: SYSTEM_POST_FALLBACK_KEY },
    create: { key: SYSTEM_POST_FALLBACK_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })

  return next
}

async function isInternalManagedHost(hostname: string): Promise<boolean> {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (!normalized) return false
  if (isMainAppHostname(normalized) || SHARED_DOMAINS.includes(normalized)) return true
  const custom = await prisma.domain.findFirst({
    where: { domain: normalized, verified: true, disabledAt: null },
    select: { id: true },
  })
  return Boolean(custom)
}

type ParsedTarget =
  | { kind: 'dedicated-post'; slug: string }
  | { kind: 'invalid-dedicated-post' }
  | { kind: 'ambiguous-root-slug'; slug: string; redirectUrl: string }
  | { kind: 'external-redirect'; redirectUrl: string }

async function classifyTargetUrl(targetUrl: string): Promise<ParsedTarget> {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    return { kind: 'invalid-dedicated-post' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'invalid-dedicated-post' }
  }

  const isInternalHost = await isInternalManagedHost(parsed.hostname)
  if (!isInternalHost) {
    return { kind: 'external-redirect', redirectUrl: parsed.toString() }
  }

  // Dedicated post namespaces (/p7/<code> and /posts/<slug>) must never 302-redirect to themselves
  // when deleted or unpublished, avoiding infinite fallback loops.
  if (parsed.pathname === '/p7' || parsed.pathname.startsWith('/p7/')) {
    const numericMatch = /^\/p7\/([1-9]\d{4})\/?$/.exec(parsed.pathname)
    const slug = numericMatch ? numericPostSlug(numericMatch[1]) : null
    return slug ? { kind: 'dedicated-post', slug } : { kind: 'invalid-dedicated-post' }
  }

  if (parsed.pathname === '/posts' || parsed.pathname.startsWith('/posts/')) {
    const postMatch = /^\/posts\/([^/]+)\/?$/.exec(parsed.pathname)
    if (!postMatch) return { kind: 'invalid-dedicated-post' }
    try {
      const slug = decodeURIComponent(postMatch[1]).trim()
      return slug ? { kind: 'dedicated-post', slug } : { kind: 'invalid-dedicated-post' }
    } catch {
      return { kind: 'invalid-dedicated-post' }
    }
  }

  // Single-segment internal paths may be either a standard ManagedPost slug or a short link (/r4noIg).
  const singleMatch = /^\/([^/]+)\/?$/.exec(parsed.pathname)
  if (singleMatch) {
    try {
      const segment = decodeURIComponent(singleMatch[1]).trim()
      if (segment && !RESERVED_SINGLE_SEGMENTS.has(segment.toLowerCase()) && !/^p7-[1-9]\d{4}$/.test(segment)) {
        return { kind: 'ambiguous-root-slug', slug: segment, redirectUrl: parsed.toString() }
      }
      if (/^p7-[1-9]\d{4}$/.test(segment)) {
        return { kind: 'dedicated-post', slug: segment }
      }
    } catch {
      // Fall through to normal redirect when percent-decoding fails.
    }
  }

  return { kind: 'external-redirect', redirectUrl: parsed.toString() }
}

export type ResolvedPostFallback<T> =
  | { kind: 'post'; post: T }
  | { kind: 'redirect'; redirectUrl: string }

export async function resolveSystemPostFallback<T>(
  loadPostBySlug: (slug: string) => Promise<T | null>,
): Promise<ResolvedPostFallback<T> | null> {
  const config = await getSystemPostFallbackConfig()
  if (!config.enabled || !config.targetUrl) return null

  const target = await classifyTargetUrl(config.targetUrl)
  if (target.kind === 'invalid-dedicated-post') return null

  if (target.kind === 'dedicated-post') {
    const post = await loadPostBySlug(target.slug)
    return post ? { kind: 'post', post } : null
  }

  if (target.kind === 'ambiguous-root-slug') {
    const post = await loadPostBySlug(target.slug)
    if (post) return { kind: 'post', post }
    return { kind: 'redirect', redirectUrl: target.redirectUrl }
  }

  return { kind: 'redirect', redirectUrl: target.redirectUrl }
}

export type FallbackTargetInspection = {
  mode: 'unconfigured' | 'post' | 'redirect' | 'missing_post'
  post: {
    id: string
    title: string
    slug: string
    publicUrl: string
    isDirectWrapper: boolean
    popupName: string | null
  } | null
}

export async function inspectFallbackTargetUrl(targetUrl: string): Promise<FallbackTargetInspection> {
  if (!targetUrl.trim()) return { mode: 'unconfigured', post: null }
  const target = await classifyTargetUrl(targetUrl)
  if (target.kind === 'invalid-dedicated-post') return { mode: 'missing_post', post: null }

  if (target.kind === 'dedicated-post' || target.kind === 'ambiguous-root-slug') {
    const post = await prisma.managedPost.findFirst({
      where: { slug: target.slug, isPublished: true, user: { status: 'active', deletedAt: null } },
      select: {
        id: true,
        title: true,
        slug: true,
        isDirectWrapper: true,
        sharedDomain: true,
        domain: { select: { domain: true } },
        popup: { select: { name: true, isActive: true } },
      },
    })
    if (post) {
      const host = post.domain?.domain || post.sharedDomain || getSiteHostname()
      return {
        mode: 'post',
        post: {
          id: post.id,
          title: post.title,
          slug: post.slug,
          publicUrl: `https://${host}${getPublicPostPath(post.slug)}`,
          isDirectWrapper: Boolean(post.isDirectWrapper),
          popupName: post.popup?.isActive ? post.popup.name : null,
        },
      }
    }
    if (target.kind === 'dedicated-post') {
      return { mode: 'missing_post', post: null }
    }
  }

  return { mode: 'redirect', post: null }
}
