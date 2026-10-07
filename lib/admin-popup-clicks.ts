import { prisma } from '@/lib/prisma'
import { popupClickWindows, type PlatformClicks } from '@/lib/popup-analytics'

export const ADMIN_POPUP_CLICKS_TIMEZONE = 'Asia/Ho_Chi_Minh'

export async function getAdminUserPopupClicksToday(userIds: string[], now: Date): Promise<Record<string, PlatformClicks>> {
  const ids = [...new Set(userIds)]
  const counts = Object.fromEntries(ids.map(id => [id, { shopee: 0, tiktok: 0, total: 0 }]))
  if (!ids.length) return counts

  // Aggregate only the selected users, using the same Vietnam day/snapshot as popup analytics.
  const rows = await prisma.popupClick.groupBy({
    by: ['userId', 'platform'],
    where: {
      userId: { in: ids },
      platform: { in: ['SHOPEE', 'TIKTOK'] },
      createdAt: { gte: popupClickWindows(now).today, lte: now },
    },
    _count: { _all: true },
  })
  for (const row of rows) {
    const stats = counts[row.userId]
    if (!stats) continue
    if (row.platform === 'SHOPEE') stats.shopee = row._count._all
    if (row.platform === 'TIKTOK') stats.tiktok = row._count._all
    stats.total = stats.shopee + stats.tiktok
  }
  return counts
}
