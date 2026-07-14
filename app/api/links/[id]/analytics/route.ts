import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { formatDateKeyVN } from '@/lib/utils'
import { getVietnamDayBoundaries, getVietnamStartOfRange } from '@/lib/vn-time'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const link = await prisma.link.findFirst({ where: { id, userId: user.id } })
  if (!link) return NextResponse.json({ error: 'Không tìm thấy link' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')

  const VN_OFFSET = 7 * 60 * 60 * 1000
  const { startOfToday } = getVietnamDayBoundaries()
  const startDate = getVietnamStartOfRange(days)

  const where = { linkId: id, createdAt: { gte: startDate } }

  try {
    const [
      totalClicks,
      clicksByDate,
      clicksByCountry,
      clicksByDevice,
      clicksByBrowser,
      clicksByOS,
      clicksByLanguage,
      clicksByReferer,
      recentClicks,
    ] = await Promise.all([
      prisma.click.count({ where }),
      prisma.click.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.click.groupBy({
        by: ['country'],
        where,
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
      }),
      prisma.click.groupBy({
        by: ['device'],
        where,
        _count: { _all: true },
      }),
      prisma.click.groupBy({
        by: ['browser'],
        where,
        _count: { _all: true },
        orderBy: { _count: { browser: 'desc' } },
      }),
      prisma.click.groupBy({
        by: ['os'],
        where,
        _count: { _all: true },
        orderBy: { _count: { os: 'desc' } },
      }),
      prisma.click.groupBy({
        by: ['language'],
        where,
        _count: { _all: true },
        orderBy: { _count: { language: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['referer'],
        where: { ...where, referer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referer: 'desc' } },
        take: 10,
      }),
      prisma.click.findMany({
        where,
        select: {
          createdAt: true,
          country: true,
          city: true,
          device: true,
          browser: true,
          os: true,
          language: true,
          referer: true,
          ip: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    // Build daily click map
    const clicksMap = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      clicksMap.set(formatDateKeyVN(d), 0)
    }
    clicksByDate.forEach((c) => {
      const key = formatDateKeyVN(c.createdAt)
      clicksMap.set(key, (clicksMap.get(key) || 0) + 1)
    })
    const dailyClicks = Array.from(clicksMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Build hourly distribution (0-23)
    const hourMap = new Map<number, number>()
    for (let h = 0; h < 24; h++) hourMap.set(h, 0)
    clicksByDate.forEach((c) => {
      const h = Math.floor((c.createdAt.getTime() - startOfToday.getTime()) / (60 * 60 * 1000)) % 24
      const safeHour = h < 0 ? h + 24 : h
      hourMap.set(safeHour, (hourMap.get(safeHour) || 0) + 1)
    })
    const byHour = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour)

    return NextResponse.json({
      totalClicks,
      dailyClicks,
      byHour,
      byCountry: clicksByCountry.map((c) => ({
        country: c.country || 'Unknown',
        count: c._count._all,
      })),
      byDevice: clicksByDevice.map((c) => ({
        device: c.device || 'Unknown',
        count: c._count._all,
      })),
      byBrowser: clicksByBrowser.map((c) => ({
        browser: c.browser || 'Unknown',
        count: c._count._all,
      })),
      byOS: clicksByOS.map((c) => ({
        os: c.os || 'Unknown',
        count: c._count._all,
      })),
      byLanguage: clicksByLanguage.map((c) => ({
        language: c.language || 'Unknown',
        count: c._count._all,
      })),
      byReferer: clicksByReferer.map((c) => ({
        referer: c.referer || 'Direct',
        count: c._count._all,
      })),
      recentClicks: recentClicks.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[analytics] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
