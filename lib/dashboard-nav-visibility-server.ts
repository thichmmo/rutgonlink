import { prisma } from '@/lib/prisma'
import {
  defaultDashboardNavVisibility,
  normalizeDashboardNavVisibility,
  OPTIONAL_DASHBOARD_NAV_KEYS,
  type DashboardNavVisibility,
} from '@/lib/dashboard-nav-visibility'

export function userNavVisibilitySettingKey(userId: string): string {
  return `user_nav_prefs:${userId}`
}

export async function getUserDashboardNavVisibility(
  userId: string,
): Promise<DashboardNavVisibility> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: userNavVisibilitySettingKey(userId) },
    })
    if (!row?.value) return defaultDashboardNavVisibility()
    return normalizeDashboardNavVisibility(JSON.parse(row.value))
  } catch {
    return defaultDashboardNavVisibility()
  }
}

export async function saveUserDashboardNavVisibility(
  userId: string,
  patch: Partial<DashboardNavVisibility>,
): Promise<DashboardNavVisibility> {
  const current = await getUserDashboardNavVisibility(userId)
  const next: DashboardNavVisibility = { ...current }
  for (const key of OPTIONAL_DASHBOARD_NAV_KEYS) {
    if (typeof patch[key] === 'boolean') {
      next[key] = patch[key]
    }
  }

  const settingKey = userNavVisibilitySettingKey(userId)
  await prisma.appSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })

  return next
}
