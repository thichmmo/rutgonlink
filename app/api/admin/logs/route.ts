import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getVietnamStartOfRange } from '@/lib/vn-time'
import { requireAdmin } from '@/lib/admin-auth'
const VN_OFFSET = 7 * 60 * 60 * 1000

function buildGarbageRequestWhere(): Prisma.RequestLogWhereInput {
  return {
    OR: [
      { ip: { in: ['::1', '127.0.0.1', '::ffff:127.0.0.1'] } },
      { method: { notIn: ['GET', 'HEAD'] } },
      { path: { startsWith: '/wp-admin' } },
      { path: { startsWith: '/wp-content' } },
      { path: { startsWith: '/wp-includes' } },
      { path: { startsWith: '/wordpress' } },
      { path: { startsWith: '/phpmyadmin' } },
      { path: { startsWith: '/cgi-bin' } },
      { path: { startsWith: '/.git' } },
      { path: { startsWith: '/.env' } },
      { path: { startsWith: '/containers' } },
      { path: { contains: 'setup-config.php' } },
      { path: { contains: 'wp-login.php' } },
      { path: { contains: 'xmlrpc.php' } },
      { path: { contains: 'boaform' } },
      { path: { contains: 'autodiscover/autodiscover.xml' } },
      { path: { contains: '/vendor/phpunit' } },
      { path: { contains: '/actuator' } },
      { path: { contains: '/server-status' } },
      { userAgent: { contains: 'bot' } },
      { userAgent: { contains: 'crawler' } },
      { userAgent: { contains: 'spider' } },
      { userAgent: { contains: 'curl/' } },
      { userAgent: { contains: 'wget/' } },
      { userAgent: { contains: 'python-requests' } },
      { userAgent: { contains: 'go-http-client' } },
      { userAgent: { contains: 'zgrab' } },
      { userAgent: { contains: 'masscan' } },
      { userAgent: { contains: 'sqlmap' } },
      { userAgent: { contains: 'nikto' } },
      { userAgent: { contains: 'nmap' } },
    ],
  }
}

export async function GET(req: NextRequest) {
  const access = await requireAdmin('logs.read')
  if (!access.ok) return access.response

  const { searchParams } = req.nextUrl
  const site = searchParams.get('site') || 'all'
  const days = parseInt(searchParams.get('days') || '7')
  const page = parseInt(searchParams.get('page') || '1')
  const ip = searchParams.get('ip') || ''
  const userEmail = searchParams.get('userEmail') || ''
  const country = searchParams.get('country') || ''
  const path = searchParams.get('path') || ''
  const device = searchParams.get('device') || ''
  const browser = searchParams.get('browser') || ''
  const limit = 50

  const since = getVietnamStartOfRange(days)
  const garbageWhere = buildGarbageRequestWhere()

  const baseWhere: Prisma.RequestLogWhereInput = {
    createdAt: { gte: since },
    ...(site !== 'all' ? { site } : {}),
    ...(ip ? { ip } : {}),
    ...(userEmail ? { userEmail: { contains: userEmail } } : {}),
    ...(country ? { country } : {}),
    ...(path ? { path: { contains: path } } : {}),
    ...(device ? { device } : {}),
    ...(browser ? { browser } : {}),
  }

  const where: Prisma.RequestLogWhereInput = {
    AND: [
      baseWhere,
      { NOT: garbageWhere },
    ],
  }

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [total, logs, topIPs, topCountries, topPaths, bySite, byDevice, byBrowser, byHourRows] =
    await Promise.all([
      prisma.requestLog.count({ where }),

      prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          site: true,
          method: true,
          path: true,
          ip: true,
          country: true,
          device: true,
          browser: true,
          os: true,
          userEmail: true,
          userId: true,
          createdAt: true,
        },
      }),

      // Top IPs với user info
      prisma.requestLog.groupBy({
        by: ['ip', 'userEmail'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // Top countries
      prisma.requestLog.groupBy({
        by: ['country'],
        where: { ...where, country: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Top paths
      prisma.requestLog.groupBy({
        by: ['path'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // By site
      prisma.requestLog.groupBy({
        by: ['site'],
        where,
        _count: { id: true },
      }),

      // By device
      prisma.requestLog.groupBy({
        by: ['device'],
        where: { ...where, device: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // By browser
      prisma.requestLog.groupBy({
        by: ['browser'],
        where: { ...where, browser: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      prisma.requestLog.findMany({
        where: {
          AND: [
            where,
            { createdAt: { gte: last24h } },
          ],
        },
        select: { createdAt: true },
      }),
    ])

  const byHourMap = new Map<number, number>()
  for (let h = 0; h < 24; h++) byHourMap.set(h, 0)
  for (const row of byHourRows) {
    const h = new Date(row.createdAt.getTime() + VN_OFFSET).getUTCHours()
    byHourMap.set(h, (byHourMap.get(h) || 0) + 1)
  }
  const byHour = Array.from(byHourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour)

  // IP dedup: nhóm tất cả user emails theo IP
  const ipMap: Record<string, { count: number; emails: Set<string> }> = {}
  for (const row of topIPs) {
    const key = row.ip || 'unknown'
    if (!ipMap[key]) ipMap[key] = { count: 0, emails: new Set() }
    ipMap[key].count += row._count.id
    if (row.userEmail) ipMap[key].emails.add(row.userEmail)
  }
  const topIPsList = Object.entries(ipMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([ip, v]) => ({ ip, count: v.count, emails: [...v.emails] }))

  return NextResponse.json({
    total,
    pages: Math.ceil(total / limit),
    logs,
    stats: {
      topIPs: topIPsList,
      topCountries: topCountries.map((r) => ({ country: r.country, count: r._count.id })),
      topPaths: topPaths.map((r) => ({ path: r.path, count: r._count.id })),
      bySite: bySite.map((r) => ({ site: r.site, count: r._count.id })),
      byDevice: byDevice.map((r) => ({ device: r.device, count: r._count.id })),
      byBrowser: byBrowser.map((r) => ({ browser: r.browser, count: r._count.id })),
      byHour,
    },
  })
}
