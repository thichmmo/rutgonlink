'use client'

import type { TelegramSettings } from '@/lib/telegram-settings'

type Props = {
  value: TelegramSettings
  onChange: (value: TelegramSettings) => void
  disabled?: boolean
  accountDefaults?: boolean
  hideEnabledToggle?: boolean
}

export default function TelegramSettingsFields({ value, onChange, disabled = false, accountDefaults = false, hideEnabledToggle = false }: Props) {
  return <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
    {!hideEnabledToggle && <label className="flex items-center justify-between gap-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
      <span><span className="block text-sm font-semibold text-gray-900">{accountDefaults ? 'Ưu tiên bài Telegram khi tạo mới' : 'Bật Telegram cho bài viết này'}</span><span className="mt-1 block text-xs text-gray-600">{accountDefaults ? 'Ghi nhớ loại ưu tiên cho tài khoản và bài tạo qua API chưa chọn loại. Trong dashboard, hai nút tạo vẫn quyết định loại bài.' : 'Video/ảnh vẫn xem ngay trên bài, không bắt vào Telegram.'}</span></span>
      <input type="checkbox" checked={value.enabled} onChange={event => onChange({ ...value, enabled: event.target.checked })} className="h-5 w-5 shrink-0 accent-sky-600" />
    </label>}
    <label className="grid gap-1.5 text-sm font-medium text-gray-700">Link nhóm/kênh Telegram
      <input type="url" maxLength={2048} value={value.url} onChange={event => onChange({ ...value, url: event.target.value })} placeholder="https://t.me/ten_nhom hoặc https://t.me/+..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" />
      <span className="text-xs font-normal text-gray-500">Lưu link để dùng lại. Bài bật Telegram cần có link nhóm/kênh hợp lệ.</span>
    </label>
    <label className="grid gap-1.5 text-sm font-medium text-gray-700">Chữ trên nút Telegram
      <input maxLength={120} value={value.buttonText} onChange={event => onChange({ ...value, buttonText: event.target.value })} placeholder="✈️ VÀO NHÓM TELEGRAM NGAY" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" />
    </label>
    <label className="grid gap-1.5 text-sm font-medium text-gray-700">Đoạn chữ dưới nút / Miễn trừ trách nhiệm
      <textarea rows={5} maxLength={4000} value={value.disclaimer} onChange={event => onChange({ ...value, disclaimer: event.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5" placeholder="Nội dung thông báo hiển thị giữa nút Telegram và video/ảnh..." />
      <span className="text-xs font-normal text-gray-500">Hiển thị dạng văn bản, giữ xuống dòng; để trống nếu không cần đoạn chữ.</span>
    </label>
  </fieldset>
}
