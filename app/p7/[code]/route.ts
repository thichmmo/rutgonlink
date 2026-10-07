import { NextRequest, NextResponse } from 'next/server'
import { GET as publicPostRoute } from '@/app/[shortCode]/route'
import { numericPostSlug } from '@/lib/public-post-link'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const slug = numericPostSlug(code)
  if (!slug) return new NextResponse('Not found', { status: 404 })
  // Reuse the host/publication guards and actual article renderer, with no redirect.
  return publicPostRoute(req, { params: Promise.resolve({ shortCode: slug }) })
}
