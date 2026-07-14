import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { formatDateKeyVN, formatDateTimeVN } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await prisma.link.findMany({
    where: { userId: user.id },
    include: { domain: true, category: true, _count: { select: { clicks: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const rows = [
    ['Mã rút gọn', 'URL gốc', 'Tiêu đề', 'Domain', 'Danh mục', 'Clicks', 'Trạng thái', 'Hết hạn', 'Giới hạn click', 'Ngày tạo'],
    ...links.map(l => [
      l.shortCode,
      l.originalUrl,
      l.title || '',
      l.domain?.domain || l.sharedDomain || '',
      l.category?.name || '',
      l._count.clicks,
      l.isActive ? 'Hoạt động' : 'Tắt',
      l.expiresAt ? formatDateTimeVN(new Date(l.expiresAt)) : '',
      l.maxClicks || '',
      formatDateTimeVN(new Date(l.createdAt)),
    ]),
  ]

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\r\n')

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="links-${formatDateKeyVN(new Date())}.csv"`,
    },
  })
}
