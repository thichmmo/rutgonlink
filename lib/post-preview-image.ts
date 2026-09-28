import { lookup } from 'node:dns/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { readFile, stat } from 'node:fs/promises'
import ipaddr from 'ipaddr.js'
import sharp from 'sharp'
import { resolveContentUploadPath, MAX_CONTENT_IMAGE_BYTES } from '@/lib/content-upload'
import { isValidIntermediateImage } from '@/lib/intermediate-image'

export function isPublicImageAddress(address: string) {
  try { return ipaddr.parse(address).range() === 'unicast' } catch { return false }
}

async function fetchImage(url: URL, signal: AbortSignal, redirects = 0): Promise<Buffer> {
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || redirects > 3) throw new Error('Invalid image URL')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(item => !isPublicImageAddress(item.address))) throw new Error('Invalid image host')
  signal.throwIfAborted()
  const address = addresses[0]
  return new Promise((resolve, reject) => {
    // Pin the validated DNS address to this request, including after redirects.
    const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, {
      agent: false, family: address.family, signal,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', 'user-agent': 'RutgonlinkPreview/1.0' },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
        response.destroy()
        try { resolve(fetchImage(new URL(response.headers.location, url), signal, redirects + 1)) } catch (error) { reject(error) }
        return
      }
      if (response.statusCode !== 200 || !/^image\/(jpeg|png|webp|gif|avif)(?:;|$)/i.test(response.headers['content-type'] || '') || Number(response.headers['content-length'] || 0) > MAX_CONTENT_IMAGE_BYTES) {
        response.destroy(); reject(new Error('Invalid image response')); return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_CONTENT_IMAGE_BYTES) { response.destroy(new Error('Image too large')); return }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })
    request.on('error', reject)
  })
}

async function readPreviewImage(source: string) {
  if (!source || !isValidIntermediateImage(source)) throw new Error('Invalid image')
  if (source.startsWith('/uploads/content/')) {
    const file = resolveContentUploadPath(source.slice('/uploads/content/'.length))
    if (!file || (await stat(file)).size > MAX_CONTENT_IMAGE_BYTES) throw new Error('Invalid image file')
    return readFile(file)
  }
  if (source.startsWith('data:')) return Buffer.from(source.slice(source.indexOf(',') + 1), 'base64')
  return fetchImage(new URL(source), AbortSignal.timeout(8000))
}

export async function renderPostPreviewImage(source: string, play: boolean) {
  const bytes = await readPreviewImage(source)
  const image = sharp(bytes, { limitInputPixels: 32_000_000 }).rotate().resize(1200, 630, { fit: 'cover' }).flatten({ background: '#ffffff' })
  if (play) {
    // Facebook reads the image bytes, not the CSS play icon in the dashboard.
    const overlay = Buffer.from('<svg width="1200" height="630"><circle cx="600" cy="315" r="62" fill="#dc2626" fill-opacity="0.95"/><path d="M584 284 L631 315 L584 346 Z" fill="white"/></svg>')
    image.composite([{ input: overlay }])
  }
  return image.jpeg({ quality: 85 }).toBuffer()
}
