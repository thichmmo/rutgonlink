import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params

  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: { ogImage: true },
  })

  if (!link?.ogImage) {
    return new Response('Not found', { status: 404 })
  }

  // If it's already a URL, redirect to it
  if (link.ogImage.startsWith('http')) {
    return Response.redirect(link.ogImage, 302)
  }

  // If it's base64, decode and serve as image
  const match = link.ogImage.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) {
    return new Response('Invalid image', { status: 400 })
  }

  const [, format, base64Data] = match
  const buffer = Buffer.from(base64Data, 'base64')

  const contentType =
    format === 'svg' ? 'image/svg+xml' : `image/${format === 'jpg' ? 'jpeg' : format}`

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
