import { readFile, stat } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { contentMimeType, resolveContentUploadPath } from '@/lib/content-upload'

type Context = { params: Promise<{ path: string[] }> }

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: Context) {
  const { path } = await params
  const filename = path?.join('/') || ''
  const filePath = resolveContentUploadPath(filename)
  if (!filePath) return new NextResponse('Not found', { status: 404 })
  try {
    const details = await stat(filePath)
    if (!details.isFile()) return new NextResponse('Not found', { status: 404 })
    const body = await readFile(filePath)
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentMimeType(filename),
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
