import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatDateKeyVN } from '@/lib/utils'
import { getVietnamStartOfRange } from '@/lib/vn-time'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
    const access = await requireAdmin('logs.read')
    if (!access.ok) return access.response

  const { searchParams } = new URL(req.url)
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') ?? '30')))

  // Work in UTC+7 (Vietnam time)
  const VN_OFFSET = 7 * 60 * 60 * 1000
  const since = getVietnamStartOfRange(days)

  const clicks = await prisma.click.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, country: true, browser: true, device: true },
  })

  // Daily clicks
  const dailyMap: Record<string, number> = {}
  const hourlyMap: Record<number, number> = {}
  const countryMap: Record<string, number> = {}
  const browserMap: Record<string, number> = {}
  const deviceMap: Record<string, number> = {}

  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
    dailyMap[formatDateKeyVN(d)] = 0
  }
  for (let h = 0; h < 24; h++) hourlyMap[h] = 0

  for (const c of clicks) {
    const vnDate = new Date(c.createdAt.getTime() + VN_OFFSET)
    const dateKey = formatDateKeyVN(c.createdAt)
    if (dateKey in dailyMap) dailyMap[dateKey]++
    const hour = vnDate.getUTCHours()
    hourlyMap[hour] = (hourlyMap[hour] ?? 0) + 1
    if (c.country) countryMap[c.country] = (countryMap[c.country] ?? 0) + 1
    if (c.browser) browserMap[c.browser] = (browserMap[c.browser] ?? 0) + 1
    if (c.device) deviceMap[c.device] = (deviceMap[c.device] ?? 0) + 1
  }

  const dailyClicks = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))
  const hourlyClicks = Object.entries(hourlyMap).map(([hour, count]) => ({ hour: parseInt(hour), count }))
  const topCountries = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }))
  const topBrowsers = Object.entries(browserMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([browser, count]) => ({ browser, count }))
  const topDevices = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([device, count]) => ({ device, count }))

  return NextResponse.json({ dailyClicks, hourlyClicks, topCountries, topBrowsers, topDevices, total: clicks.length })
}
