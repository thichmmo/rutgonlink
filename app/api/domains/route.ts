import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const domainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/,
      'Domain không hợp lệ'
    ),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const domains = await prisma.domain.findMany({
    where: { userId: user.id },
    include: { _count: { select: { links: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(domains)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { domain } = domainSchema.parse(body)

    // Plan validation: check custom domain limit
    {
      const { getPlanLimits, isPlanActive } = await import('@/lib/plan-limits')
      const limits = getPlanLimits(user.plan)
      const isActive = isPlanActive(user.plan, user.planExpiresAt)
      const effectivePlan = isActive ? user.plan : 'free'
      const effectiveLimits = getPlanLimits(effectivePlan)

      if (effectiveLimits.maxDomains === 0) {
        return NextResponse.json(
          { error: 'Gói Cơ Bản không hỗ trợ domain tùy chỉnh. Vui lòng nâng cấp lên gói Pro trở lên.' },
          { status: 403 }
        )
      }

      if (effectiveLimits.maxDomains !== Infinity && typeof effectiveLimits.maxDomains === 'number') {
        const domainCount = await prisma.domain.count({ where: { userId: user.id } })
        if (domainCount >= effectiveLimits.maxDomains) {
          return NextResponse.json(
            { error: `Gói ${effectivePlan.toUpperCase()} chỉ cho phép tối đa ${effectiveLimits.maxDomains} domain. Vui lòng nâng cấp để thêm domain.` },
            { status: 403 }
          )
        }
      }
    }

    const existing = await prisma.domain.findUnique({ where: { domain } })
    if (existing) {
      return NextResponse.json({ error: 'Domain đã được sử dụng' }, { status: 400 })
    }

    const newDomain = await prisma.domain.create({
      data: {
        userId: user.id,
        domain,
        verified: false,
      },
      include: { _count: { select: { links: true } } },
    })

    return NextResponse.json(newDomain, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
