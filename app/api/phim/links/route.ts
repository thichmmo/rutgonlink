import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://vmephim.media',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  const [links, desktopSetting] = await Promise.all([
    prisma.phimRedirectLink.findMany({
      where: { isActive: true },
      select: { id: true, url: true, label: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.appSetting.findUnique({
      where: { key: 'phim_desktop_redirect_url' },
    }),
  ])

  return NextResponse.json(
    { links, desktopRedirectUrl: desktopSetting?.value ?? null },
    { headers: CORS_HEADERS },
  )
}
