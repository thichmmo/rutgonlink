import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getPlanLimits, isPlanActive } from '@/lib/plan-limits'
import { formatDateKeyVN } from '@/lib/utils'
import { getVietnamDayBoundaries, getVietnamStartOfRange } from '@/lib/vn-time'

type AnalyticsResponse = {
  totalClicks: number
  todayClicks: number
  dailyClicks: { date: string; count: number }[]
  byCountry: { country: string; count: number }[]
  byCity: { city: string; country: string; count: number }[]
  byDevice: { device: string; count: number }[]
  byDeviceModel: { deviceModel: string; count: number }[]
  byBrowser: { browser: string; count: number }[]
  byOSDetail: { os: string; count: number }[]
  byLanguage: { language: string; count: number }[]
  byReferer: { referer: string; count: number }[]
}

const ANALYTICS_CACHE_TTL_MS = 30 * 1000
const analyticsCache = new Map<string, { expiresAt: number; data: AnalyticsResponse }>()

function normalizeLanguage(lang: string | null): string {
  if (!lang || lang.trim() === '') return 'Unknown'
  const code = lang.toLowerCase().split('-')[0]
  const map: Record<string, string> = {
    vi: 'Tiếng Việt', en: 'English', zh: 'Chinese', ja: 'Japanese',
    ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish',
    pt: 'Portuguese', ru: 'Russian', ar: 'Arabic', th: 'Thai',
    id: 'Indonesian', ms: 'Malay', it: 'Italian', nl: 'Dutch',
    pl: 'Polish', tr: 'Turkish', sv: 'Swedish', da: 'Danish',
    no: 'Norwegian', fi: 'Finnish', uk: 'Ukrainian', hi: 'Hindi',
    tl: 'Filipino', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian',
  }
  return map[code] || lang
}

function extractDomain(referer: string | null): string {
  if (!referer || referer.trim() === '') return 'Direct'
  try {
    const hostname = new URL(referer).hostname.replace(/^www\./, '')
    return hostname || 'Direct'
  } catch {
    return 'Direct'
  }
}

function getOSLabel(os: string | null, osVersion: string | null): string {
  const name = os || 'Unknown'
  if (!osVersion) return name
  const major = osVersion.split('.')[0]
  return `${name} ${major}`
}

function getCachedAnalytics(key: string) {
  const cached = analyticsCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    analyticsCache.delete(key)
    return null
  }
  return cached.data
}

function setCachedAnalytics(key: string, data: AnalyticsResponse) {
  if (analyticsCache.size > 200) analyticsCache.clear()
  analyticsCache.set(key, { expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS, data })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const linkId = searchParams.get('linkId')
  const parsedDays = parseInt(searchParams.get('days') || '30')
  const requestedDays = Number.isFinite(parsedDays) ? Math.max(1, parsedDays) : 30

  // Cap days based on plan's stats retention limit
  const isActive = isPlanActive(user.plan, user.planExpiresAt)
  const effectivePlan = user.plan !== 'free' && !isActive ? 'free' : user.plan
  const limits = getPlanLimits(effectivePlan)
  const maxDays = limits.statsRetentionDays ?? requestedDays
  const cappedDays = Math.min(requestedDays, maxDays)
  const cacheKey = `${user.id}:${linkId || 'all'}:${cappedDays}`
  const cached = getCachedAnalytics(cacheKey)
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  }

  const { startOfToday: todayStart, startOfTomorrow: tomorrowStart } = getVietnamDayBoundaries()
  const startDate = getVietnamStartOfRange(cappedDays)
  const scopedLinks = await prisma.link.findMany({
    where: {
      userId: user.id,
      ...(linkId ? { id: linkId } : {}),
    },
    select: { id: true },
  })
  const scopedLinkIds = scopedLinks.map((link) => link.id)

  if (scopedLinkIds.length === 0) {
    const emptyDays = Array.from({ length: cappedDays }, (_, i) => {
      const d = new Date(startDate)
      d.setUTCDate(d.getUTCDate() + i)
      return { date: formatDateKeyVN(d), count: 0 }
    })
    const response: AnalyticsResponse = {
      totalClicks: 0,
      todayClicks: 0,
      dailyClicks: emptyDays,
      byCountry: [],
      byCity: [],
      byDevice: [],
      byDeviceModel: [],
      byBrowser: [],
      byOSDetail: [],
      byLanguage: [],
      byReferer: [],
    }
    setCachedAnalytics(cacheKey, response)
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  }

  const where: Prisma.ClickWhereInput = {
    linkId: { in: scopedLinkIds },
    createdAt: { gte: startDate },
  }

  const dailyClicksQuery = linkId
    ? Prisma.sql`
        SELECT DATE_FORMAT(DATE_ADD(c.createdAt, INTERVAL 7 HOUR), '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM \`Click\` c
        WHERE c.linkId = ${scopedLinkIds[0]}
          AND c.createdAt >= ${startDate}
        GROUP BY date
        ORDER BY date ASC
      `
    : Prisma.sql`
        SELECT DATE_FORMAT(DATE_ADD(c.createdAt, INTERVAL 7 HOUR), '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM \`Click\` c
        WHERE c.linkId IN (${Prisma.join(scopedLinkIds)})
          AND c.createdAt >= ${startDate}
        GROUP BY date
        ORDER BY date ASC
      `

  const [
    totalClicks,
    todayClicks,
    dailyClickRows,
    clicksByCountry,
    clicksByCity,
    clicksByDevice,
    clicksByDeviceModel,
    clicksByBrowser,
    rawOSDetail,
    rawLanguages,
    rawReferers,
  ] = await Promise.all([
    prisma.click.count({ where }),
    prisma.click.count({
      where: {
        linkId: { in: scopedLinkIds },
        createdAt: { gte: todayStart, lt: tomorrowStart },
      },
    }),
    // Aggregate to one row per Vietnam day in SQL; grouping raw timestamps can return tens of thousands of rows.
    prisma.$queryRaw<Array<{ date: string; count: bigint | number }>>(dailyClicksQuery),
    prisma.click.groupBy({
      by: ['country'],
      where,
      _count: { _all: true },
      orderBy: { _count: { country: 'desc' } },
      take: 20,
    }),
    prisma.click.groupBy({
      by: ['city', 'country'],
      where: { ...where, city: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { city: 'desc' } },
      take: 15,
    }),
    prisma.click.groupBy({
      by: ['device'],
      where,
      _count: { _all: true },
    }),
    prisma.click.groupBy({
      by: ['deviceModel'],
      where: { ...where, deviceModel: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { deviceModel: 'desc' } },
      take: 15,
    }),
    prisma.click.groupBy({
      by: ['browser'],
      where,
      _count: { _all: true },
      orderBy: { _count: { browser: 'desc' } },
      take: 10,
    }),
    prisma.click.groupBy({
      by: ['os', 'osVersion'],
      where,
      _count: { _all: true },
      orderBy: { _count: { os: 'desc' } },
      take: 30,
    }),
    prisma.click.groupBy({
      by: ['language'],
      where,
      _count: { _all: true },
      orderBy: { _count: { language: 'desc' } },
      take: 50,
    }),
    prisma.click.groupBy({
      by: ['referer'],
      where,
      _count: { _all: true },
      orderBy: { _count: { referer: 'desc' } },
      take: 200,
    }),
  ])

  // Group clicks by day
  const clicksMap = new Map<string, number>()
  for (let i = 0; i < cappedDays; i++) {
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + i)
    clicksMap.set(formatDateKeyVN(d), 0)
  }
  dailyClickRows.forEach((row) => {
    clicksMap.set(row.date, Number(row.count))
  })
  const dailyClicks = Array.from(clicksMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Normalize OS (combine os + osVersion into label)
  const osMap = new Map<string, number>()
  for (const item of rawOSDetail) {
    const label = getOSLabel(item.os, item.osVersion)
    osMap.set(label, (osMap.get(label) || 0) + item._count._all)
  }
  const byOSDetail = Array.from(osMap.entries())
    .map(([os, count]) => ({ os, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Normalize languages
  const langMap = new Map<string, number>()
  for (const item of rawLanguages) {
    const label = normalizeLanguage(item.language)
    langMap.set(label, (langMap.get(label) || 0) + item._count._all)
  }
  const byLanguage = Array.from(langMap.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Normalize referers → extract domain
  const refMap = new Map<string, number>()
  for (const item of rawReferers) {
    const domain = extractDomain(item.referer)
    refMap.set(domain, (refMap.get(domain) || 0) + item._count._all)
  }
  const byReferer = Array.from(refMap.entries())
    .map(([referer, count]) => ({ referer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Filter empty cities
  const byCity = clicksByCity
    .filter((c) => c.city && c.city.trim())
    .map((c) => ({ city: c.city!, country: c.country || '', count: c._count._all }))

  const response: AnalyticsResponse = {
    totalClicks,
    todayClicks,
    dailyClicks,
    byCountry: clicksByCountry.map((c) => ({ country: c.country || 'Unknown', count: c._count._all })),
    byCity,
    byDevice: clicksByDevice.map((c) => ({ device: c.device || 'Unknown', count: c._count._all })),
    byDeviceModel: clicksByDeviceModel.map((c) => ({ deviceModel: c.deviceModel!, count: c._count._all })),
    byBrowser: clicksByBrowser.map((c) => ({ browser: c.browser || 'Unknown', count: c._count._all })),
    byOSDetail,
    byLanguage,
    byReferer,
  }

  setCachedAnalytics(cacheKey, response)

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
