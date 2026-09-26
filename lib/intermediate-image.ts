export const MAX_INTERMEDIATE_IMAGE_LENGTH = 2 * 1024 * 1024

export function isValidIntermediateImage(value: string): boolean {
  if (!value) return true
  if (value.length > MAX_INTERMEDIATE_IMAGE_LENGTH) return false
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return true
  if (/^\/uploads\/content\/[A-Za-z0-9_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
