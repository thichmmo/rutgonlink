import { buildPublicAssetUrl, getSiteUrl } from '@/lib/site-config'
import { isValidIntermediateImage } from '@/lib/intermediate-image'

type PostPreview = { id: string; previewImage?: string | null; updatedAt?: Date | string }

export function getPostPreviewImageUrl(post: PostPreview) {
  if (!post.previewImage || !isValidIntermediateImage(post.previewImage)) return null
  // Serve uploads, data images and the baked-in play overlay from the primary host.
  const version = post.updatedAt ? new Date(post.updatedAt).getTime() : 0
  return buildPublicAssetUrl(`/api/posts/${encodeURIComponent(post.id)}/preview-image?v=${version}`, getSiteUrl())
}
