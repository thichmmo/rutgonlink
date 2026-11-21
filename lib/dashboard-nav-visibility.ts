export const OPTIONAL_DASHBOARD_NAV_KEYS = [
  'links',
  'folders',
  'analytics',
  'notes',
  'fbDebug',
  'tiktokAff',
] as const

export type OptionalDashboardNavKey = (typeof OPTIONAL_DASHBOARD_NAV_KEYS)[number]

export type DashboardNavVisibility = Record<OptionalDashboardNavKey, boolean>

export const DASHBOARD_NAV_EVENT = 'dashboard-nav-updated'

export const OPTIONAL_DASHBOARD_NAV_META: Array<{
  key: OptionalDashboardNavKey
  href: string
  label: string
  description: string
}> = [
  {
    key: 'links',
    href: '/dashboard/links',
    label: 'Links',
    description: 'Quản lý danh sách link rút gọn và nút "Tạo link mới" trên thanh đầu trang.',
  },
  {
    key: 'folders',
    href: '/dashboard/folders',
    label: 'Folders',
    description: 'Quản lý thư mục và xoay vòng link tự động theo ngày.',
  },
  {
    key: 'analytics',
    href: '/dashboard/analytics',
    label: 'Thống kê',
    description: 'Trang thống kê chi tiết lượt click của link rút gọn.',
  },
  {
    key: 'notes',
    href: '/dashboard/notes',
    label: 'Ghi chú',
    description: 'Ghi chú cá nhân và đồng bộ Google Drive.',
  },
  {
    key: 'fbDebug',
    href: '/dashboard/fb-debug',
    label: 'FB Debug',
    description: 'Công cụ quét lại Open Graph Facebook bằng dàn token.',
  },
  {
    key: 'tiktokAff',
    href: '/dashboard/tiktok-link',
    label: 'TikTok AFF',
    description: 'Công cụ chuyển đổi và xử lý link TikTok Affiliate.',
  },
]

const HREF_TO_KEY: Record<string, OptionalDashboardNavKey> = {
  '/dashboard/links': 'links',
  '/dashboard/folders': 'folders',
  '/dashboard/analytics': 'analytics',
  '/dashboard/notes': 'notes',
  '/dashboard/fb-debug': 'fbDebug',
  '/dashboard/tiktok-link': 'tiktokAff',
}

export function defaultDashboardNavVisibility(): DashboardNavVisibility {
  return {
    links: true,
    folders: true,
    analytics: true,
    notes: true,
    fbDebug: true,
    tiktokAff: true,
  }
}

export function normalizeDashboardNavVisibility(input: unknown): DashboardNavVisibility {
  const base = defaultDashboardNavVisibility()
  if (!input || typeof input !== 'object') return base
  const record = input as Record<string, unknown>
  for (const key of OPTIONAL_DASHBOARD_NAV_KEYS) {
    if (typeof record[key] === 'boolean') {
      base[key] = record[key]
    }
  }
  return base
}

export function isDashboardHrefVisible(
  href: string,
  visibility: DashboardNavVisibility,
): boolean {
  const key = HREF_TO_KEY[href]
  return key ? Boolean(visibility[key]) : true
}
