import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getPlanLimits, isPlanActive } from '@/lib/plan-limits'
import { customAlphabet } from 'nanoid'

const generateKey = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  32
)

function getEffectiveLimits(user: { plan: string; planExpiresAt: Date | null }) {
  const isActive = isPlanActive(user.plan, user.planExpiresAt)
  const effectivePlan = user.plan !== 'free' && !isActive ? 'free' : user.plan
  return { effectivePlan, limits: getPlanLimits(effectivePlan) }
}

/** GET /api/user/api-key — trả về API key hiện tại (null nếu chưa tạo) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { email: session.user.email },
    select: { id: true, plan: true, planExpiresAt: true, apiKey: true },
  })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limits, effectivePlan } = getEffectiveLimits(user)
  if (!limits.canUseApi) {
    return NextResponse.json(
      {
        error: 'Gói dịch vụ không hỗ trợ API. Vui lòng nâng cấp lên Ultra hoặc Ultra+.',
        canUseApi: false,
        plan: effectivePlan,
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ apiKey: user.apiKey ?? null, canUseApi: true })
}

/** POST /api/user/api-key — tạo mới / cấp lại API key */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { email: session.user.email },
    select: { id: true, plan: true, planExpiresAt: true },
  })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limits, effectivePlan } = getEffectiveLimits(user)
  if (!limits.canUseApi) {
    return NextResponse.json(
      {
        error: 'Gói dịch vụ không hỗ trợ API. Vui lòng nâng cấp lên Ultra hoặc Ultra+.',
        canUseApi: false,
        plan: effectivePlan,
      },
      { status: 403 }
    )
  }

  const apiKey = `ls_live_${generateKey()}`
  await (prisma.user.update as any)({
    where: { id: user.id },
    data: { apiKey },
  })

  return NextResponse.json({ apiKey, canUseApi: true })
}

/** DELETE /api/user/api-key — thu hồi API key */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await (prisma.user.update as any)({
    where: { id: user.id },
    data: { apiKey: null },
  })

  return NextResponse.json({ ok: true })
}
