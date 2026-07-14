import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBot } from '@/lib/bot-detect'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://vmephim.media',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getRealIp(request: NextRequest): string | null {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
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

    const body = await request.json()
    const { linkId, device, browser, os, referer } = body
    const ip = getRealIp(request)

    await prisma.phimMovieClick.create({
      data: {
        linkId: linkId ?? null,
        ip,
        device: device ?? null,
        browser: browser ?? null,
        os: os ?? null,
        referer: referer ?? null,
      },
    })

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400, headers: CORS_HEADERS })
  }
}
