import { z } from 'zod'

export type TelegramSettings = {
  enabled: boolean
  url: string
  buttonText: string
  disclaimer: string
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

const plainText = (max: number) => z.string().trim().max(max)
  .refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), 'Nội dung có ký tự không hợp lệ')

export const telegramSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().max(2048).refine(isTelegramUrl, 'Link Telegram phải là HTTPS trên t.me hoặc telegram.me'),
  buttonText: plainText(120).refine(value => value.length > 0, 'Vui lòng nhập chữ trên nút Telegram'),
  disclaimer: plainText(4000),
}).strict().superRefine((value, context) => {
  if (value.enabled && !value.url) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'Vui lòng nhập link Telegram trước khi bật' })
  }
})

export function normalizeTelegramSettings(value: unknown): TelegramSettings {
  const defaults = defaultTelegramSettings()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
  const record = value as Record<string, unknown>
  const parsed = telegramSettingsSchema.safeParse({
    enabled: record.enabled ?? defaults.enabled,
    url: record.url ?? defaults.url,
    buttonText: record.buttonText ?? defaults.buttonText,
    disclaimer: record.disclaimer ?? defaults.disclaimer,
  })
  // Legacy nulls and invalid stored links stay disabled; never inherit account settings here.
  return parsed.success ? parsed.data : defaults
}
