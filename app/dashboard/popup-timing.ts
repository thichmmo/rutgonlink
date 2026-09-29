import { normalizePopupSettings } from '@/lib/popup-settings'

type TimingPlatform = {
  delaySeconds?: number | string | null
}

export type PopupTimingSettings = {
  shopee?: TimingPlatform | null
  tiktok?: TimingPlatform | null
  cooldownMinutes?: number | string | null
}

export function popupTiming(settings?: PopupTimingSettings | null) {
  // Legacy/null JSON must display the same defaults and limits as the public runtime.
  const normalized = normalizePopupSettings(settings)
  return {
    shopeeSeconds: normalized.shopee.delaySeconds,
    tiktokSeconds: normalized.tiktok.delaySeconds,
    cooldownMinutes: normalized.cooldownMinutes,
  }
}

export function popupTimingLabel(settings?: PopupTimingSettings | null) {
  const timing = popupTiming(settings)
  return `S ${timing.shopeeSeconds}s · T ${timing.tiktokSeconds}s · Cooldown ${timing.cooldownMinutes}m`
}
