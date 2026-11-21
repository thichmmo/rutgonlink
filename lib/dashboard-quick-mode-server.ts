import { getPublicationTargets } from '@/lib/content-management'
import {
  defaultDashboardQuickMode,
  normalizeDashboardQuickMode,
  type DashboardQuickMode,
} from '@/lib/dashboard-quick-mode'
import { getSystemDefaultPostDomain } from '@/lib/post-default-domain-config'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'
import { normalizeTelegramSettings, type TelegramSettings } from '@/lib/telegram-settings'
import { defaultPostDomainKey } from '@/app/dashboard/posts/post-create-defaults'

export type QuickTelegramConfig = {
  latestPopup: { id: string; name: string } | null
  domainId: string | null
  sharedDomain: string | null
  domainName: string
  telegramDefaults: TelegramSettings
}

export function userQuickModeSettingKey(userId: string): string {
  return `user_quick_create_mode:${userId}`
}

export async function getUserDashboardQuickMode(userId: string): Promise<DashboardQuickMode> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: userQuickModeSettingKey(userId) },
    })
    if (!row?.value) return defaultDashboardQuickMode()
    return normalizeDashboardQuickMode(JSON.parse(row.value))
  } catch {
    return defaultDashboardQuickMode()
  }
}

export async function saveUserDashboardQuickMode(
  userId: string,
  mode: DashboardQuickMode,
): Promise<DashboardQuickMode> {
  const normalized = normalizeDashboardQuickMode(mode)
  const settingKey = userQuickModeSettingKey(userId)
  await prisma.appSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: JSON.stringify({ mode: normalized }) },
    update: { value: JSON.stringify({ mode: normalized }) },
  })
  return normalized
}

// Prefer the popup attached to the user's most recently created post; fall back to newest active popup.
export async function getMostRecentlyUsedActivePopup(
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const recentPost = await prisma.managedPost.findFirst({
    where: {
      userId,
      popupId: { not: null },
      popup: { isActive: true },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { popup: { select: { id: true, name: true } } },
  })
  if (recentPost?.popup) {
    return { id: recentPost.popup.id, name: recentPost.popup.name }
  }

  const newestPopup = await prisma.popupTemplate.findFirst({
    where: { userId, isActive: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, name: true },
  })
  return newestPopup ? { id: newestPopup.id, name: newestPopup.name } : null
}

export async function getQuickTelegramDashboardConfig(
  userId: string,
): Promise<QuickTelegramConfig> {
  const [latestPopup, domains, defaultDomainCfg, user] = await Promise.all([
    getMostRecentlyUsedActivePopup(userId),
    getPublicationTargets(userId),
    getSystemDefaultPostDomain(),
    prisma.user.findUnique({ where: { id: userId }, select: { telegramSettings: true } }),
  ])

  const domainKey = defaultPostDomainKey(domains, defaultDomainCfg.defaultDomain)
  const custom = domains.find((item) => item.kind === 'custom' && item.id === domainKey)
  const shared = domainKey.startsWith('shared:') ? domainKey.slice(7) : null
  const domainName = custom?.domain || shared || getSiteHostname()

  return {
    latestPopup,
    domainId: custom?.id || null,
    sharedDomain: custom ? null : shared,
    domainName,
    telegramDefaults: normalizeTelegramSettings(user?.telegramSettings),
  }
}
