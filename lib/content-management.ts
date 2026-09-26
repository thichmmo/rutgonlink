import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { isValidIntermediateImage, MAX_INTERMEDIATE_IMAGE_LENGTH } from '@/lib/intermediate-image'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { getSiteHostname } from '@/lib/site-config'
import { defaultPopupSettings, normalizePopupSettings, type PopupSettings } from '@/lib/popup-settings'

const externalUrl = z.url().max(2048).refine((value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}, 'Chỉ chấp nhận URL HTTP(S) hợp lệ')

export const popupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional().default(true),
  imageUrl: z.string().max(MAX_INTERMEDIATE_IMAGE_LENGTH)
    .refine(isValidIntermediateImage, 'Ảnh phải là URL HTTP(S) hoặc ảnh tải lên').nullable().optional(),
  firstUrl: externalUrl,
  secondUrl: externalUrl,
  settings: z.unknown().optional(),
})

export const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(190),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  content: z.string().trim().min(1).max(200000),
  contentFormat: z.enum(['plain', 'rich', 'raw-html']).optional().default('plain'),
  popupId: z.string().nullable().optional(),
  popupIds: z.array(z.string()).max(20).optional(),
  domainId: z.string().nullable().optional(),
  sharedDomain: z.string().nullable().optional(),
  previewImage: z.string().max(MAX_INTERMEDIATE_IMAGE_LENGTH).nullable().optional(),
  isPublished: z.boolean().optional().default(false),
})

export const fixedContentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(200000),
  contentFormat: z.enum(['plain', 'rich', 'raw-html']).default('rich'),
  placement: z.enum(['before', 'after']).default('after'),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
})

export type ManagedContentActor = {
  id: string
  email: string
  isAdmin: boolean
}

export async function getManagedContentActor(): Promise<ManagedContentActor | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const email = session.user.email
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true, deletedAt: true, adminRole: true },
  })
  if (!user || user.status !== 'active' || user.deletedAt) return null
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.email.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() || Boolean(user.adminRole),
  }
}

export async function getManagedContentUserId() {
  return (await getManagedContentActor())?.id ?? null
}

export async function ownsPopup(userId: string, popupId: string | null | undefined) {
  if (!popupId) return true
  return Boolean(await prisma.popupTemplate.findFirst({ where: { id: popupId, userId, isActive: true }, select: { id: true } }))
}

export async function ownsPopupRecord(userId: string, popupId: string | null | undefined) {
  if (!popupId) return true
  return Boolean(await prisma.popupTemplate.findFirst({ where: { id: popupId, userId }, select: { id: true } }))
}

export async function ownsActivePopups(userId: string, popupIds: string[]) {
  const ids = [...new Set(popupIds.filter(Boolean))]
  if (!ids.length) return true
  const count = await prisma.popupTemplate.count({ where: { id: { in: ids }, userId, isActive: true } })
  return count === ids.length
}

export function normalizeSettings(settings: unknown, firstUrl: string, secondUrl: string): PopupSettings {
  const normalized = normalizePopupSettings(settings, firstUrl, secondUrl)
  const safe = (value: string, fallback: string) => {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : fallback
    } catch {
      return fallback
    }
  }
  normalized.shopee.url = safe(normalized.shopee.url, firstUrl)
  normalized.tiktok.url = safe(normalized.tiktok.url, secondUrl)
  normalized.tiktok.androidUrl = safe(normalized.tiktok.androidUrl, secondUrl)
  normalized.tiktok.iosUrl = safe(normalized.tiktok.iosUrl, secondUrl)
  return normalized
}

export function sanitizeRichHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
}

export function normalizeContent(content: string, contentFormat: 'plain' | 'rich' | 'raw-html', isAdmin: boolean) {
  if (contentFormat === 'raw-html' && !isAdmin) throw new Error('Chỉ admin mới được nhúng HTML/Script trực tiếp')
  return contentFormat === 'rich' ? sanitizeRichHtml(content) : content
}

export async function validatePublicationTarget(userId: string, domainId?: string | null, sharedDomain?: string | null) {
  if (domainId && sharedDomain) throw new Error('Chỉ chọn một domain xuất bản')
  if (sharedDomain) {
    const normalized = sharedDomain.trim().toLowerCase()
    if (!SHARED_DOMAINS.includes(normalized)) throw new Error('Domain dùng chung không hợp lệ')
    return { domainId: null, sharedDomain: normalized }
  }
  if (domainId) {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, userId, verified: true, disabledAt: null }, select: { id: true } })
    if (!domain) throw new Error('Domain chưa xác minh hoặc không thuộc tài khoản')
    return { domainId: domain.id, sharedDomain: null }
  }
  return { domainId: null, sharedDomain: null }
}

export function normalizeContentFormat(value: string | undefined): 'plain' | 'rich' | 'raw-html' {
  return value === 'rich' || value === 'raw-html' ? value : 'plain'
}

export async function getPublicationTargets(userId: string) {
  const customDomains = await prisma.domain.findMany({
    where: { userId, verified: true, disabledAt: null },
    select: { id: true, domain: true },
    orderBy: { domain: 'asc' },
  })
  return [
    { id: null, domain: getSiteHostname(), kind: 'primary' as const },
    ...SHARED_DOMAINS.map(domain => ({ id: null, domain, kind: 'shared' as const })),
    ...customDomains.map(domain => ({ id: domain.id, domain: domain.domain, kind: 'custom' as const })),
  ]
}

export function getPopupDefaults(firstUrl = '', secondUrl = '') {
  return defaultPopupSettings(firstUrl, secondUrl)
}
