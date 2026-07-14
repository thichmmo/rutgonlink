import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { recordAdminAudit } from '@/lib/admin-audit'

// GET: Lấy tất cả redirect links (kèm tổng click) + desktop redirect URL
export async function GET() {
  const access = await requireAdmin('system.read')
  if (!access.ok) return access.response

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
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response

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

  await recordAdminAudit({
    admin: access.admin,
    request,
    action: 'phim-link.create',
    entityType: 'phim_link',
    entityId: link.id,
    reason: 'Tạo redirect link',
    after: link,
  })

  return NextResponse.json(link, { status: 201 })
}

// PUT: Cập nhật link
export async function PUT(request: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response

  const body = await request.json()
  const { id, url, label, isActive, sortOrder } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const before = await prisma.phimRedirectLink.findUnique({ where: { id } })
  const link = await prisma.phimRedirectLink.update({
    where: { id },
    data: {
      ...(url !== undefined && { url: url.trim() }),
      ...(label !== undefined && { label: label?.trim() || null }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  })

  await recordAdminAudit({
    admin: access.admin,
    request,
    action: 'phim-link.update',
    entityType: 'phim_link',
    entityId: id,
    reason: 'Cập nhật redirect link',
    before,
    after: link,
  })

  return NextResponse.json(link)
}

// PATCH: Cập nhật desktop redirect URL
export async function PATCH(request: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response

  const { desktopRedirectUrl } = await request.json()

  await prisma.appSetting.upsert({
    where: { key: 'phim_desktop_redirect_url' },
    update: { value: desktopRedirectUrl?.trim() ?? '' },
    create: { key: 'phim_desktop_redirect_url', value: desktopRedirectUrl?.trim() ?? '' },
  })

  await recordAdminAudit({
    admin: access.admin,
    request,
    action: 'phim.desktop-redirect.update',
    entityType: 'system',
    reason: 'Cập nhật desktop redirect',
    after: { configured: Boolean(desktopRedirectUrl?.trim()) },
  })

  return NextResponse.json({ ok: true })
}

// DELETE: Xóa link
export async function DELETE(request: NextRequest) {
  const access = await requireAdmin('system.write')
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const before = await prisma.phimRedirectLink.findUnique({ where: { id } })
  await prisma.phimRedirectLink.delete({ where: { id } })

  await recordAdminAudit({
    admin: access.admin,
    request,
    action: 'phim-link.delete',
    entityType: 'phim_link',
    entityId: id,
    reason: 'Xóa redirect link',
    before,
  })

  return NextResponse.json({ ok: true })
}
