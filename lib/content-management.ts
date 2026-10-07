import { getServerSession } from 'next-auth'
import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { isValidIntermediateImage, MAX_INTERMEDIATE_IMAGE_LENGTH } from '@/lib/intermediate-image'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { getSiteHostname } from '@/lib/site-config'
import { defaultPopupSettings, normalizePopupSettings, type PopupSettings } from '@/lib/popup-settings'
import { getAllowedIframeHostnames, normalizeVideoEmbedUrl } from '@/lib/video-embed'
import { telegramSettingsSchema } from '@/lib/telegram-settings'
import { isValidPopupAffiliateUrl, MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_INVALID, POPUP_AFFILIATE_URL_TOO_LONG } from '@/lib/popup-affiliate-url'

const externalUrl = z.string().max(MAX_POPUP_AFFILIATE_URL_LENGTH, POPUP_AFFILIATE_URL_TOO_LONG)
  .refine(isValidPopupAffiliateUrl, POPUP_AFFILIATE_URL_INVALID)

export const popupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional().default(true),
  imageUrl: z.string().max(MAX_INTERMEDIATE_IMAGE_LENGTH)
    .refine(isValidIntermediateImage, 'Ảnh phải là URL HTTP(S) hoặc ảnh tải lên').nullable().optional(),
  firstUrl: externalUrl,
  secondUrl: externalUrl,
  settings: z.unknown().optional(),
}).superRefine((data, context) => {
  if (!data.settings || typeof data.settings !== 'object') return
  const settings = data.settings as Record<string, unknown>
  const fields = [
    ['shopee', 'url', 'Link Shopee'],
    ['tiktok', 'url', 'Link TikTok'],
    ['tiktok', 'androidUrl', 'Link TikTok Android'],
    ['tiktok', 'iosUrl', 'Link TikTok iOS'],
  ] as const
  for (const [platform, field, label] of fields) {
    const values = settings[platform]
    if (!values || typeof values !== 'object') continue
    const value = (values as Record<string, unknown>)[field]
    // Reject excess length before normalization can silently replace a signed link.
    if (typeof value === 'string' && value.length > MAX_POPUP_AFFILIATE_URL_LENGTH) {
      context.addIssue({ code: 'custom', path: ['settings', platform, field], message: `${label}: ${POPUP_AFFILIATE_URL_TOO_LONG}` })
    }
  }
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
  previewImage: z.string().max(MAX_INTERMEDIATE_IMAGE_LENGTH)
    .refine(isValidIntermediateImage, 'Ảnh phải là URL HTTP(S) hoặc ảnh tải lên').nullable().optional(),
  isFakeVideo: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(false),
  telegramSettings: telegramSettingsSchema.optional(),
})

// Numeric links are a create-only opt-in; older clients and every edit keep slugs.
export const createPostSchema = postSchema.extend({
  slug: postSchema.shape.slug.optional(),
  publicLinkMode: z.literal('numeric').optional(),
}).superRefine((data, context) => {
  if (data.publicLinkMode !== 'numeric' && !data.slug) {
    context.addIssue({ code: 'custom', path: ['slug'], message: 'Vui lòng nhập đường dẫn bài viết' })
  }
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
    isAdmin: user.email.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() || user.adminRole === 'owner' || user.adminRole === 'ops',
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
  const safe = (value: string, fallback: string) => isValidPopupAffiliateUrl(value) ? value : fallback
  normalized.shopee.url = safe(normalized.shopee.url, firstUrl)
  normalized.tiktok.url = safe(normalized.tiktok.url, secondUrl)
  normalized.tiktok.androidUrl = safe(normalized.tiktok.androidUrl, secondUrl)
  // All platform fields share the same limit; never truncate signed affiliate payloads.
  normalized.tiktok.iosUrl = safe(normalized.tiktok.iosUrl, secondUrl)
  const safeImage = (value: string | null) => value && value.length <= MAX_INTERMEDIATE_IMAGE_LENGTH && isValidIntermediateImage(value) ? value : null
  normalized.shopee.imageUrl = safeImage(normalized.shopee.imageUrl)
  normalized.tiktok.imageUrl = safeImage(normalized.tiktok.imageUrl)
  return normalized
}

export function sanitizeRichHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'iframe', 'video', 'source', 'figure', 'figcaption', 'h1', 'h2'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading'],
      video: ['src', 'poster', 'controls', 'width', 'height', 'preload', 'playsinline'],
      source: ['src', 'type'],
      figure: ['class'],
      div: ['class'],
    },
    allowedClasses: { figure: ['video-embed', 'video-portrait'], div: ['video-embed', 'video-portrait'] },
    // Repair legacy share-URL iframes before host filtering; never leave an empty frame.
    transformTags: {
      iframe: (_tag, attributes) => {
        const embed = normalizeVideoEmbedUrl(attributes.src || '')
        if (!embed) return { tagName: 'span', attribs: {} as Record<string, string> }
        if (embed.kind === 'video') return { tagName: 'video', attribs: { src: embed.url, controls: '', playsinline: '', preload: 'metadata' } as Record<string, string> }
        return { tagName: 'iframe', attribs: { src: embed.url, title: embed.title, width: embed.portrait ? '360' : '560', height: embed.portrait ? '640' : '315', loading: 'lazy', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '' } as Record<string, string> }
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'], iframe: ['https'], video: ['http', 'https', 'data'], source: ['http', 'https', 'data'] },
    allowedIframeHostnames: getAllowedIframeHostnames(),
  })
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
