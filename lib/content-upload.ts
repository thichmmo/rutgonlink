import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

export const CONTENT_UPLOAD_ROUTE = '/uploads/content'
export const MAX_CONTENT_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_CONTENT_VIDEO_BYTES = 50 * 1024 * 1024

const MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/ogg': '.ogv',
  'video/webm': '.webm',
}

export function getContentUploadDirectory() {
  // Keep media outside the atomically swapped standalone tree on cPanel.
  const configured = process.env.CONTENT_UPLOAD_DIR?.trim()
  if (configured) return resolve(configured)
  const cwd = /*turbopackIgnore: true*/ process.cwd().replace(/[\\/]+$/, '')
  const standaloneSuffix = `${sep}.next${sep}standalone`
  if (cwd.endsWith(standaloneSuffix)) {
    // Release preflight runs below `.deploy/<id>/unpacked`; live Passenger runs
    // below `.next/standalone`. Both must resolve to the persistent app media.
    const deployMarker = `${sep}.deploy${sep}`
    const deployIndex = cwd.indexOf(deployMarker)
    if (deployIndex >= 0) return resolve(cwd.slice(0, deployIndex), 'uploads', 'content')
    return resolve(cwd, '..', '..', 'uploads', 'content')
  }
  return resolve(join(cwd, 'uploads', 'content'))
}

export function getContentUploadPolicy(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized.startsWith('image/') && MIME_EXTENSIONS[normalized]) {
    return { kind: 'image' as const, maxBytes: MAX_CONTENT_IMAGE_BYTES, extension: MIME_EXTENSIONS[normalized] }
  }
  if (normalized.startsWith('video/') && MIME_EXTENSIONS[normalized]) {
    return { kind: 'video' as const, maxBytes: MAX_CONTENT_VIDEO_BYTES, extension: MIME_EXTENSIONS[normalized] }
  }
  return null
}

export async function saveContentUpload(bytes: ArrayBuffer, mimeType: string) {
  const policy = getContentUploadPolicy(mimeType)
  if (!policy) throw new Error('Chỉ hỗ trợ ảnh PNG/JPG/WebP/GIF/AVIF hoặc video MP4/WebM/OGG')
  if (bytes.byteLength > policy.maxBytes) throw new Error(`${policy.kind === 'image' ? 'Ảnh' : 'Video'} vượt quá dung lượng cho phép`)

  const directory = getContentUploadDirectory()
  await mkdir(directory, { recursive: true })
  const filename = `${randomUUID()}${policy.extension}`
  const filePath = join(directory, filename)
  await writeFile(filePath, Buffer.from(bytes))
  return { filename, url: `${CONTENT_UPLOAD_ROUTE}/${filename}`, kind: policy.kind, mimeType, size: bytes.byteLength }
}

export function resolveContentUploadPath(filename: string) {
  if (!/^[A-Za-z0-9_-]+\.(?:avif|gif|jpe?g|mp4|ogv|png|webm|webp)$/i.test(filename)) return null
  const directory = getContentUploadDirectory()
  const candidate = resolve(directory, filename)
  return candidate.startsWith(`${directory}${process.platform === 'win32' ? '\\' : '/'}`) ? candidate : null
}

export function contentMimeType(filename: string) {
  const extension = filename.toLowerCase().split('.').pop()
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
    : extension === 'png' ? 'image/png'
      : extension === 'webp' ? 'image/webp'
        : extension === 'gif' ? 'image/gif'
          : extension === 'avif' ? 'image/avif'
            : extension === 'mp4' ? 'video/mp4'
              : extension === 'ogv' ? 'video/ogg'
                : 'video/webm'
}
