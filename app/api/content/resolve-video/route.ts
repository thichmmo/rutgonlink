import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getManagedContentUserId } from '@/lib/content-management'
import { ArticleVideoError, MAX_ARTICLE_VIDEO_URL_LENGTH, parseArticleVideoUrl, resolveArticleVideoUrl } from '@/lib/article-video'

export const runtime = 'nodejs'

const schema = z.object({ url: z.string().trim().min(1, 'Vui lòng nhập URL bài viết')
  .max(MAX_ARTICLE_VIDEO_URL_LENGTH, 'URL không được vượt quá 8192 ký tự')
  .refine(value => Boolean(parseArticleVideoUrl(value)), 'Vui lòng nhập URL bài viết HTTPS hợp lệ, không có tài khoản hoặc cổng riêng') })

export async function POST(req: NextRequest) {
  // Check the managed-content account before parsing or reaching external hosts.
  if (!(await getManagedContentUserId())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const input = schema.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || 'URL bài viết không hợp lệ' }, { status: 400 })
  try {
    return NextResponse.json({ url: await resolveArticleVideoUrl(input.data.url), kind: 'video' })
  } catch (error) {
    const status = error instanceof ArticleVideoError ? error.status : 502
    const message = error instanceof ArticleVideoError ? error.message : 'Không lấy được video từ bài viết. Vui lòng thử lại.'
    return NextResponse.json({ error: message }, { status })
  }
}
