import { z } from 'zod'

export const TELEGRAM_BUTTON_COLORS = ['telegram', 'orange', 'emerald', 'dark'] as const
export type TelegramButtonColor = (typeof TELEGRAM_BUTTON_COLORS)[number]

export type TelegramExtraButton = {
  url: string
  buttonText: string
  color?: TelegramButtonColor
}

export type TelegramSettings = {
  enabled: boolean
  url: string
  buttonText: string
  disclaimer: string
  extraButtons?: TelegramExtraButton[]
}

export function defaultTelegramSettings(): TelegramSettings {
  return {
    enabled: false,
    url: '',
    buttonText: '✈️ VÀO NHÓM TELEGRAM NGAY',
    disclaimer: 'Nội dung được tổng hợp từ các nguồn công khai và chỉ mang tính tham khảo. Nếu bạn phát hiện thông tin chưa chính xác hoặc cần yêu cầu chỉnh sửa, gỡ bỏ nội dung, vui lòng liên hệ với người quản lý trang để được xem xét.',
  }
}

function isTelegramUrl(value: string) {
  if (!value) return true
  // URL parsing alone accepts backslashes/whitespace and can hide credential tricks.
  if (/\s|\\/.test(value)) return false
  try {
    const parsed = new URL(value)
    return value.startsWith('https://') && parsed.protocol === 'https:' &&
      ['t.me', 'telegram.me'].includes(parsed.hostname) && !parsed.username &&
      !parsed.password && !parsed.port && parsed.pathname.length > 1
  } catch { return false }
}

export function isSafeHttpsActionUrl(value: string) {
  if (!value || /\s|\\/.test(value)) return false
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    return value.startsWith('https://') &&
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      host.includes('.') &&
      !host.endsWith('.localhost') &&
      !host.endsWith('.local')
  } catch {
    return false
  }
}

const plainText = (max: number) => z.string().trim().max(max)
  .refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), 'Nội dung có ký tự không hợp lệ')

export const telegramExtraButtonSchema = z.object({
  url: z.string().trim().max(2048).refine(
    isSafeHttpsActionUrl,
    'Link nút phụ phải là HTTPS hợp lệ (ví dụ https://t.me/... hoặc https://mesale.vn/...)',
  ),
  buttonText: plainText(120).refine(value => value.length > 0, 'Vui lòng nhập chữ trên nút bấm phụ'),
  color: z.enum(TELEGRAM_BUTTON_COLORS).optional(),
}).strict()

export const telegramSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().max(2048).refine(isTelegramUrl, 'Link Telegram phải là HTTPS trên t.me hoặc telegram.me'),
  buttonText: plainText(120).refine(value => value.length > 0, 'Vui lòng nhập chữ trên nút Telegram'),
  disclaimer: plainText(4000),
  extraButtons: z.array(telegramExtraButtonSchema).max(6, 'Tối đa 6 nút bấm phụ').optional(),
}).strict().superRefine((value, context) => {
  if (value.enabled && !value.url) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'Vui lòng nhập link Telegram trước khi bật' })
  }
}).transform((value): TelegramSettings => {
  const cleaned = value.extraButtons?.map((btn) => ({
    url: btn.url,
    buttonText: btn.buttonText,
    ...(btn.color && btn.color !== 'telegram' ? { color: btn.color } : {}),
  }))
  // Omit extraButtons when empty so existing single-button snapshots stay byte-identical.
  return {
    enabled: value.enabled,
    url: value.url,
    buttonText: value.buttonText,
    disclaimer: value.disclaimer,
    ...(cleaned && cleaned.length > 0 ? { extraButtons: cleaned } : {}),
  }
})

export function normalizeTelegramSettings(value: unknown): TelegramSettings {
  const defaults = defaultTelegramSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
  const record = value as Record<string, unknown>
  const validExtras = Array.isArray(record.extraButtons)
    ? record.extraButtons
        .map((item) => telegramExtraButtonSchema.safeParse(item))
        .filter((res) => res.success)
        .map((res) => res.data)
        .slice(0, 6)
    : undefined

  const parsed = telegramSettingsSchema.safeParse({
    enabled: record.enabled ?? defaults.enabled,
    url: record.url ?? defaults.url,
    buttonText: record.buttonText ?? defaults.buttonText,
    disclaimer: record.disclaimer ?? defaults.disclaimer,
    ...(validExtras && validExtras.length > 0 ? { extraButtons: validExtras } : {}),
  })
  // Legacy nulls and invalid stored links stay disabled; never inherit account settings here.
  return parsed.success ? parsed.data : defaults
}
