export type PlatformClicks = { shopee: number; tiktok: number; total: number }
export type PopupClickStats = { hour: PlatformClicks; today: PlatformClicks; yesterday: PlatformClicks; dayBefore: PlatformClicks }
export type ClickGroup = 'post' | 'popup'
export const CLICK_WINDOWS = [
  { key: 'hour', label: '1 giờ qua' }, { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' }, { key: 'dayBefore', label: 'Hôm kia' },
] as const

export function popupClickWindows(now = new Date()) {
  const day = 86400000
  // Vietnam has no DST; calculate UTC query boundaries independently of the server timezone.
  const today = Math.floor((now.getTime() + 7 * 3600000) / day) * day - 7 * 3600000
  return { now, hour: new Date(now.getTime() - 3600000), today: new Date(today), yesterday: new Date(today - day), dayBefore: new Date(today - 2 * day) }
}

export function popupClickStats(row: Record<string, unknown> = {}): PopupClickStats {
  const value = (name: string) => Math.max(0, Number(row[name] || 0))
  const period = (name: string) => {
    const shopee = value(`${name}Shopee`), tiktok = value(`${name}Tiktok`)
    return { shopee, tiktok, total: shopee + tiktok }
  }
  return { hour: period('hour'), today: period('today'), yesterday: period('yesterday'), dayBefore: period('dayBefore') }
}

export type ClickStatsItem = { id: string; title: string; image: string | null; slug?: string; publicUrl?: string; popupName?: string | null; postCount?: number; createdAt: string; stats: PopupClickStats }
export type ClickStatsList = { items: ClickStatsItem[]; total: number; page: number; pageSize: number }
export type PopupAnalyticsResponse = { totals: PopupClickStats; posts: ClickStatsList; popups: ClickStatsList; generatedAt: string; timezone: string }
export type PopupCountsResponse = { totals: PopupClickStats; counts: Record<string, PopupClickStats>; generatedAt: string }
