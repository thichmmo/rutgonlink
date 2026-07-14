import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBot } from '@/lib/bot-detect'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://vmephim.media',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getRealIp(request: NextRequest): string {
  // CF-Connecting-IP: real client IP when behind Cloudflare
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') ?? ''
    if (isBot(ua)) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
    }

    const ip = getRealIp(request)

    let device: string | null = null
    let browser: string | null = null
    let os: string | null = null
    let referer: string | null = null
    try {
      const body = await request.json()
      device = body?.device ?? null
      browser = body?.browser ?? null
      os = body?.os ?? null
      referer = body?.referer ?? null
    } catch {
      // body không bắt buộc
    }

    await prisma.phimPageVisit.create({
      data: { ip, userAgent: ua || null, device, browser, os, referer },
    })

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500, headers: CORS_HEADERS })
  }
}
