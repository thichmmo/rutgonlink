export type Plan = 'free' | 'pro' | 'ultra' | 'ultra_plus'
export type Period = '1m' | '6m' | '1y' | 'lifetime'

export interface PlanLimits {
  maxLinks: number | null          // null = unlimited
  maxClicksPerMonth: number | null // null = unlimited
  maxDomains: number               // 0 = no custom domains
  canDeviceRedirect: boolean
  canGeoRedirect: boolean
  canUseApi: boolean
  statsRetentionDays: number | null // null = unlimited
  prioritySupport: boolean
}

// Free plan: unlimited everything for now (user will validate later)
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxLinks: null,
    maxClicksPerMonth: null,
    maxDomains: Infinity as unknown as number,
    canDeviceRedirect: true,
    canGeoRedirect: true,
    canUseApi: true,
    statsRetentionDays: null,
    prioritySupport: true,
  },
  pro: {
    maxLinks: 5000,
    maxClicksPerMonth: 50000,
    maxDomains: 1,
    canDeviceRedirect: true,
    canGeoRedirect: false,
    canUseApi: false,
    statsRetentionDays: 90,
    prioritySupport: false,
  },
  ultra: {
    maxLinks: null,
    maxClicksPerMonth: 500000,
    maxDomains: 5,
    canDeviceRedirect: true,
    canGeoRedirect: true,
    canUseApi: true,
    statsRetentionDays: null,
    prioritySupport: false,
  },
  ultra_plus: {
    maxLinks: null,
    maxClicksPerMonth: null,
    maxDomains: Infinity as unknown as number,
    canDeviceRedirect: true,
    canGeoRedirect: true,
    canUseApi: true,
    statsRetentionDays: null,
    prioritySupport: true,
  },
}

// Base monthly prices (VND)
export const MONTHLY_PRICE: Record<Exclude<Plan, 'free'>, number> = {
  pro: 29000,
  ultra: 119000,
  ultra_plus: 299000,
}

// How many months you PAY FOR (not how long you get)
// 1m → pay 1, get 1
// 6m → pay 4, get 6
// 1y → pay 9, get 12
// lifetime → pay 15, keep forever
export const PERIOD_BILLING_MONTHS: Record<Period, number> = {
  '1m': 1,
  '6m': 4,
  '1y': 9,
  'lifetime': 15,
}

// How many months of access you receive
export const PERIOD_ACCESS_MONTHS: Record<Exclude<Period, 'lifetime'>, number> = {
  '1m': 1,
  '6m': 6,
  '1y': 12,
}

export function calculatePrice(plan: Exclude<Plan, 'free'>, period: Period): number {
  return MONTHLY_PRICE[plan] * PERIOD_BILLING_MONTHS[period]
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}

export function isPlanActive(plan: string, planExpiresAt: Date | null): boolean {
  if (plan === 'free') return true
  if (!planExpiresAt) return true  // lifetime plan — no expiry date
  return planExpiresAt > new Date()
}

export const PLAN_DISPLAY: Record<Plan, string> = {
  free: 'Cơ Bản',
  pro: 'Pro',
  ultra: 'Ultra',
  ultra_plus: 'Ultra+',
}

export const PLAN_COLOR: Record<Plan, string> = {
  free: 'gray',
  pro: 'blue',
  ultra: 'indigo',
  ultra_plus: 'purple',
}

export const PERIOD_DISPLAY: Record<Period, string> = {
  '1m': '1 tháng',
  '6m': '6 tháng',
  '1y': '1 năm',
  'lifetime': 'Trọn đời',
}

export function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ'
}

// Normalize text for bank transfer content matching (uppercase, alphanumeric only)
export function normalizeTransferContent(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Returns an error message if the plan doesn't support device redirect, or null if allowed */
export function checkDeviceRedirectAllowed(plan: string, planExpiresAt: Date | null): string | null {
  const effectivePlan = (plan !== 'free' && !isPlanActive(plan, planExpiresAt)) ? 'free' : plan
  const limits = getPlanLimits(effectivePlan)
  if (!limits.canDeviceRedirect) {
    return 'Chuyển hướng theo thiết bị yêu cầu gói Pro trở lên. Vui lòng nâng cấp tại /pricing.'
  }
  return null
}

/** Returns an error message if the plan doesn't support geo redirect, or null if allowed */
export function checkGeoRedirectAllowed(plan: string, planExpiresAt: Date | null): string | null {
  const effectivePlan = (plan !== 'free' && !isPlanActive(plan, planExpiresAt)) ? 'free' : plan
  const limits = getPlanLimits(effectivePlan)
  if (!limits.canGeoRedirect) {
    return 'Chuyển hướng theo quốc gia yêu cầu gói Ultra trở lên. Vui lòng nâng cấp tại /pricing.'
  }
  return null
}
