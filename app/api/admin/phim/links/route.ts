import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL
}

// GET: Lấy tất cả redirect links (kèm tổng click) + desktop redirect URL
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [links, desktopSetting] = await Promise.all([
    prisma.phimRedirectLink.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { clicks: true } } },
    }),
    prisma.appSetting.findUnique({ where: { key: 'phim_desktop_redirect_url' } }),
  ])

  return NextResponse.json({ links, desktopRedirectUrl: desktopSetting?.value ?? '' })
}

// POST: Thêm link mới
export async function POST(request: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { url, label, isActive, sortOrder } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const link = await prisma.phimRedirectLink.create({
    data: {
      url: url.trim(),
      label: label?.trim() || null,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    },
  })

  return NextResponse.json(link, { status: 201 })
}

// PUT: Cập nhật link
export async function PUT(request: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { id, url, label, isActive, sortOrder } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const link = await prisma.phimRedirectLink.update({
    where: { id },
    data: {
      ...(url !== undefined && { url: url.trim() }),
      ...(label !== undefined && { label: label?.trim() || null }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  })

  return NextResponse.json(link)
}

// PATCH: Cập nhật desktop redirect URL
export async function PATCH(request: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { desktopRedirectUrl } = await request.json()

  await prisma.appSetting.upsert({
    where: { key: 'phim_desktop_redirect_url' },
    update: { value: desktopRedirectUrl?.trim() ?? '' },
    create: { key: 'phim_desktop_redirect_url', value: desktopRedirectUrl?.trim() ?? '' },
  })

  return NextResponse.json({ ok: true })
}

// DELETE: Xóa link
export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  await prisma.phimRedirectLink.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
