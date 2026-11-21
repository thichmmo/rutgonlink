export const DASHBOARD_QUICK_MODES = ['shorten', 'telegram-post'] as const

export type DashboardQuickMode = (typeof DASHBOARD_QUICK_MODES)[number]

export function defaultDashboardQuickMode(): DashboardQuickMode {
  return 'shorten'
}

export function normalizeDashboardQuickMode(input: unknown): DashboardQuickMode {
  if (input === 'telegram-post') return 'telegram-post'
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const mode = (input as Record<string, unknown>).mode
    if (mode === 'telegram-post') return 'telegram-post'
  }
  return 'shorten'
}
