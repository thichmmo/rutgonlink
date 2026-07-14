import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getPlanLimits, isPlanActive, PLAN_DISPLAY } from '@/lib/plan-limits'
import { getVietnamDayBoundaries, getVietnamStartOfMonthUtc } from '@/lib/vn-time'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawPlan = user.plan
  const planExpiresAt = user.planExpiresAt
  const isActive = isPlanActive(rawPlan, planExpiresAt)
  const effectivePlan = rawPlan !== 'free' && !isActive ? 'free' : rawPlan
  const limits = getPlanLimits(effectivePlan)

  // Count links
  const firstOfMonth = getVietnamStartOfMonthUtc()
  const { startOfToday, startOfTomorrow } = getVietnamDayBoundaries()

  const [linkCount, domainCount, clicksToday, clicksThisMonth] = await Promise.all([
    prisma.link.count({ where: { userId: user.id } }),
    prisma.domain.count({ where: { userId: user.id } }),
    prisma.click.count({
      where: { link: { userId: user.id }, createdAt: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    prisma.click.count({
      where: { link: { userId: user.id }, createdAt: { gte: firstOfMonth } },
    }),
  ])

  return NextResponse.json({
    plan: effectivePlan,
    planLabel: PLAN_DISPLAY[effectivePlan as keyof typeof PLAN_DISPLAY] ?? 'Cơ Bản',
    planExpiresAt,
    isActive,
    linkCount,
    domainCount,
    clicksToday,
    clicksThisMonth,
    limits: {
      maxLinks: limits.maxLinks,
      maxClicksPerMonth: limits.maxClicksPerMonth,
      maxDomains: limits.maxDomains,
      canDeviceRedirect: limits.canDeviceRedirect,
      canGeoRedirect: limits.canGeoRedirect,
      canUseApi: limits.canUseApi,
      statsRetentionDays: limits.statsRetentionDays,
    },
  })
}
