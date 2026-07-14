import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isGarbageRequestLog } from '@/lib/request-log-filter'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-log-key')
  if (key !== process.env.LOG_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const data = await req.json()
    if (isGarbageRequestLog({ method: data.method, path: data.path, userAgent: data.userAgent, ip: data.ip })) {
      return NextResponse.json({ ok: true })
    }

    // Dedup: same IP + userId within 60 seconds = skip (1 visit counts as 1)
    const oneMinuteAgo = new Date(Date.now() - 60_000)
    const recent = await prisma.requestLog.findFirst({
      where: {
        ip: data.ip || null,
        userId: data.userId || null,
        path: (data.path || '/').slice(0, 500),
        createdAt: { gte: oneMinuteAgo },
      },
      select: { id: true },
    })
    if (recent) return NextResponse.json({ ok: true })

    await prisma.requestLog.create({
      data: {
        site: data.site || 'rutgon',
        method: data.method || 'GET',
        path: (data.path || '/').slice(0, 500),
        ip: data.ip || null,
        country: data.country || null,
        device: data.device || null,
        browser: data.browser || null,
        os: data.os || null,
        userAgent: data.userAgent || null,
        referer: data.referer || null,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
