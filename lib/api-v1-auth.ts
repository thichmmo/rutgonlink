import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlanLimits, isPlanActive } from '@/lib/plan-limits'
import { buildSiteUrl, getSiteHostname, isMainAppHostname } from '@/lib/site-config'

export type ApiUser = {
  id: string
  email: string
  plan: string
  planExpiresAt: Date | null
  apiKey: string | null
}

export type ApiAuthResult =
  | { ok: true; user: ApiUser }
  | { ok: false; response: NextResponse }

/**
 * Xác thực API key cho các route /api/v1/*
 * - Kiểm tra host phải là domain chính/alias cấu hình từ NEXTAUTH_URL (trừ khi dev mode)
 * - Kiểm tra header X-API-Key hoặc Authorization: Bearer <key>
 * - Kiểm tra gói dịch vụ có hỗ trợ API (Ultra / Ultra+)
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult> {
  // Domain restriction — bỏ qua khi chạy local dev
  if (process.env.NODE_ENV !== 'development') {
    const host = (
      req.headers.get('x-forwarded-host') ||
      req.headers.get('host') ||
      ''
    ).split(':')[0].toLowerCase()

    if (!isMainAppHostname(host)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'API chỉ khả dụng tại ' + getSiteHostname(),
            code: 'INVALID_HOST',
          },
          { status: 403 }
        ),
      }
    }
  }

  // Lấy API key từ header
  const authHeader = req.headers.get('authorization') || ''
  const apiKey =
    req.headers.get('x-api-key') ||
    (authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null)

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Thiếu API key. Vui lòng cung cấp header X-API-Key hoặc Authorization: Bearer <key>.',
          code: 'MISSING_API_KEY',
        },
        { status: 401 }
      ),
    }
  }

  // Tìm user theo API key
  const user = await prisma.user.findUnique({ where: { apiKey } })
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'API key không hợp lệ hoặc đã bị thu hồi.', code: 'INVALID_API_KEY' },
        { status: 401 }
      ),
    }
  }

  // Kiểm tra gói dịch vụ
  const isActive = isPlanActive(user.plan, user.planExpiresAt)
  const effectivePlan = user.plan !== 'free' && !isActive ? 'free' : user.plan
  const limits = getPlanLimits(effectivePlan)

  if (!limits.canUseApi) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
        `Gói dịch vụ hiện tại không hỗ trợ API. Vui lòng nâng cấp lên gói Ultra hoặc Ultra+ tại ${buildSiteUrl('/pricing')}.`,
          code: 'PLAN_NOT_SUPPORTED',
          currentPlan: effectivePlan,
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true, user }
}
