import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getVietnamDayBoundaries, getVietnamStartOfMonthUtc, getVietnamStartOfRange } from '@/lib/vn-time'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

function normLabel(v: string | null): string {
  return v && v.trim() ? v : 'Không rõ'
}

function extractDomain(referer: string | null): string | null {
  if (!referer) return null
  try {
    const url = new URL(referer)
    return url.hostname
  } catch {
    return referer.slice(0, 60)
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7', 10)

  const { startOfToday } = getVietnamDayBoundaries()
  const startOfMonth = getVietnamStartOfMonthUtc()
  const startOfRange = getVietnamStartOfRange(days)

  const [
    // ---- Click stats ----
    totalClicks,
    clicksToday,
    clicksThisMonth,
    desktopFakeClicks,
    clicksByDayRaw,
    clicksByLinkRaw,

    // ---- Visit stats ----
    totalVisits,
    visitsToday,
    visitsThisMonth,
    visitsByDayRaw,

    // ---- Device/Browser/OS breakdown ----
    visitsByDeviceRaw,
    visitsByBrowserRaw,
    visitsByOsRaw,
    clicksByDeviceRaw,
    clicksByBrowserRaw,

    // ---- Referer breakdown ----
    topReferersRaw,

    // ---- IP analytics ----
    ipAnalyticsRaw,
  ] = await Promise.all([
    // Click totals
    prisma.phimMovieClick.count(),
    prisma.phimMovieClick.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.phimMovieClick.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.phimMovieClick.count({ where: { device: 'desktop-fake' } }),

    // Clicks by day
    prisma.$queryRaw`
      SELECT DATE(CONVERT_TZ(createdAt, '+00:00', '+07:00')) AS date,
             COUNT(*) AS count
      FROM PhimMovieClick
      WHERE createdAt >= ${startOfRange}
      GROUP BY date ORDER BY date ASC
    ` as Promise<Array<{ date: Date | string; count: bigint }>>,

    // Clicks by link
    prisma.phimMovieClick.groupBy({
      by: ['linkId'],
      _count: { id: true },
      where: { createdAt: { gte: startOfRange } },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Visit totals
    prisma.phimPageVisit.count(),
    prisma.phimPageVisit.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.phimPageVisit.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Visits by day
    prisma.$queryRaw`
      SELECT DATE(CONVERT_TZ(createdAt, '+00:00', '+07:00')) AS date,
             COUNT(*) AS count
      FROM PhimPageVisit
      WHERE createdAt >= ${startOfRange}
      GROUP BY date ORDER BY date ASC
    ` as Promise<Array<{ date: Date | string; count: bigint }>>,

    // Device/browser/OS breakdowns (all-time)
    prisma.phimPageVisit.groupBy({ by: ['device'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.phimPageVisit.groupBy({ by: ['browser'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.phimPageVisit.groupBy({ by: ['os'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.phimMovieClick.groupBy({ by: ['device'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.phimMovieClick.groupBy({ by: ['browser'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),

    // Top referers (where visitors came from)
    prisma.phimPageVisit.groupBy({
      by: ['referer'],
      _count: { id: true },
      where: { referer: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),

    // IP analytics: top 50 IPs by visit count with click count
    prisma.$queryRaw`
      SELECT
        v.ip,
        v.visitCount,
        v.lastVisit,
        COALESCE(c.clickCount, 0) AS clickCount,
        c.lastClick,
        CASE WHEN v.visitCount > 0
             THEN ROUND(COALESCE(c.clickCount, 0) / v.visitCount * 100, 1)
             ELSE 0 END AS clickRate
      FROM (
        SELECT ip, COUNT(*) AS visitCount, MAX(createdAt) AS lastVisit
        FROM PhimPageVisit
        WHERE ip IS NOT NULL AND ip != 'unknown'
        GROUP BY ip
      ) v
      LEFT JOIN (
        SELECT ip, COUNT(*) AS clickCount, MAX(createdAt) AS lastClick
        FROM PhimMovieClick
        WHERE ip IS NOT NULL
        GROUP BY ip
      ) c ON v.ip = c.ip
      ORDER BY v.visitCount DESC
      LIMIT 50
    ` as Promise<Array<{ ip: string; visitCount: bigint; lastVisit: Date; clickCount: bigint; lastClick: Date | null; clickRate: number }>>,
  ])

  // Build date map for comparison chart
  const visitDayMap = new Map<string, number>()
  for (const r of visitsByDayRaw) {
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    visitDayMap.set(d, Number(r.count))
  }
  const clickDayMap = new Map<string, number>()
  for (const r of clicksByDayRaw) {
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    clickDayMap.set(d, Number(r.count))
  }

  const allDates: string[] = []
  const todayTs = startOfToday.getTime()
  for (let t = startOfRange.getTime(); t <= todayTs; t += 86400_000) {
    allDates.push(new Date(t + 7 * 3600_000).toISOString().slice(0, 10))
  }

  const comparisonByDay = allDates.map((date) => ({
    date,
    visits: visitDayMap.get(date) ?? 0,
    clicks: clickDayMap.get(date) ?? 0,
  }))

  // Resolve link names
  const linkIds = clicksByLinkRaw.map((c) => c.linkId).filter((id): id is string => id !== null)
  const links = linkIds.length
    ? await prisma.phimRedirectLink.findMany({
        where: { id: { in: linkIds } },
        select: { id: true, url: true, label: true },
      })
    : []
  const linkMap = new Map(links.map((l) => [l.id, l]))

  // Normalize referers to domains
  const refererMap = new Map<string, number>()
  for (const r of topReferersRaw) {
    const domain = extractDomain(r.referer)
    if (!domain) continue
    refererMap.set(domain, (refererMap.get(domain) ?? 0) + r._count.id)
  }
  const topReferers = [...refererMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([referer, count]) => ({ referer, count }))

  return NextResponse.json({
    // Click stats
    totalClicks,
    clicksToday,
    clicksThisMonth,
    desktopFakeClicks,
    clicksByDay: clicksByDayRaw.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      count: Number(r.count),
    })),
    clicksByLink: clicksByLinkRaw
      .filter((c) => c.linkId !== null)
      .map((c) => ({
        linkId: c.linkId,
        url: linkMap.get(c.linkId!)?.url ?? '(deleted)',
        label: linkMap.get(c.linkId!)?.label ?? null,
        count: c._count.id,
      })),

    // Visit stats
    totalVisits,
    visitsToday,
    visitsThisMonth,
    visitsByDay: visitsByDayRaw.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      count: Number(r.count),
    })),

    // Comparison chart
    comparisonByDay,

    // Device/Browser/OS breakdowns
    visitsByDevice: visitsByDeviceRaw.map((r) => ({ label: normLabel(r.device), count: r._count.id })),
    visitsByBrowser: visitsByBrowserRaw.map((r) => ({ label: normLabel(r.browser), count: r._count.id })),
    visitsByOs: visitsByOsRaw.map((r) => ({ label: normLabel(r.os), count: r._count.id })),
    clicksByDevice: clicksByDeviceRaw.map((r) => ({ label: normLabel(r.device), count: r._count.id })),
    clicksByBrowser: clicksByBrowserRaw.map((r) => ({ label: normLabel(r.browser), count: r._count.id })),

    // Referer
    topReferers,

    // IP analytics
    ipAnalytics: ipAnalyticsRaw.map((r) => ({
      ip: r.ip,
      visits: Number(r.visitCount),
      clicks: Number(r.clickCount),
      clickRate: Number(r.clickRate),
      lastVisit: r.lastVisit instanceof Date ? r.lastVisit.toISOString() : String(r.lastVisit),
      lastClick: r.lastClick instanceof Date ? r.lastClick.toISOString() : (r.lastClick ? String(r.lastClick) : null),
    })),
  })
}
