import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { isValidIntermediateImage, MAX_INTERMEDIATE_IMAGE_LENGTH } from '@/lib/intermediate-image'

const externalUrl = z.url().max(2048).refine((value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}, 'Chỉ chấp nhận URL HTTP(S) hợp lệ')

export const popupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageUrl: z.string().max(MAX_INTERMEDIATE_IMAGE_LENGTH)
    .refine(isValidIntermediateImage, 'Ảnh phải là URL HTTP(S) hoặc ảnh tải lên').nullable().optional(),
  firstUrl: externalUrl,
  secondUrl: externalUrl,
})

export const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(190),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  content: z.string().trim().min(1).max(200000),
  popupId: z.string().nullable().optional(),
  isPublished: z.boolean(),
})

export async function getManagedContentUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, status: true, deletedAt: true },
  })
  return user?.status === 'active' && !user.deletedAt ? user.id : null
}

export async function ownsPopup(userId: string, popupId: string | null | undefined) {
  if (!popupId) return true
  return Boolean(await prisma.popupTemplate.findFirst({ where: { id: popupId, userId }, select: { id: true } }))
}
