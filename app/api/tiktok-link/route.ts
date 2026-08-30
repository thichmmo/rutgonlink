import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  expandAndConvertTikTokLink,
  TikTokLinkError,
} from '@/lib/tiktok-link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  url: z.string().trim().url('Link TikTok không hợp lệ').max(4096, 'Link TikTok quá dài'),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimitKey = session.user.id || getClientIp(req)
  if (!checkRateLimit(`tiktok-link:${rateLimitKey}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau một phút' },
      { status: 429 },
    )
  }

  try {
    const body = requestSchema.parse(await req.json())
    const result = await expandAndConvertTikTokLink(body.url)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }

    if (error instanceof TikTokLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('POST /api/tiktok-link error:', error)
    return NextResponse.json({ error: 'Không thể xử lý link TikTok' }, { status: 500 })
  }
}
