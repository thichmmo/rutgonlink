'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { TelegramButtonColor, TelegramExtraButton, TelegramSettings } from '@/lib/telegram-settings'

type Props = {
  value: TelegramSettings
  onChange: (value: TelegramSettings) => void
  disabled?: boolean
  accountDefaults?: boolean
  hideEnabledToggle?: boolean
}

const COLOR_OPTIONS: Array<{ value: TelegramButtonColor; label: string }> = [
  { value: 'telegram', label: 'Xanh Telegram' },
  { value: 'orange', label: 'Cam nổi bật (Mê Sale)' },
  { value: 'emerald', label: 'Xanh lá' },
  { value: 'dark', label: 'Đen đậm' },
]

export default function TelegramSettingsFields({
  value,
  onChange,
  disabled = false,
  accountDefaults = false,
  hideEnabledToggle = false,
}: Props) {
  const extras = value.extraButtons || []

  const setExtras = (next: TelegramExtraButton[]) => {
    const { extraButtons: _unused, ...rest } = value
    void _unused
    onChange(next.length > 0 ? { ...rest, extraButtons: next } : rest)
  }

  const addExtraButton = (preset?: TelegramExtraButton) => {
    if (extras.length >= 6) return
    setExtras([
      ...extras,
      preset ?? { url: '', buttonText: '🔥 NHÓM TELEGRAM DỰ PHÒNG', color: 'telegram' },
    ])
  }

  const updateExtraButton = (index: number, patch: Partial<TelegramExtraButton>) => {
    setExtras(extras.map((item, idx) => (idx === index ? { ...item, ...patch } : item)))
  }

  const removeExtraButton = (index: number) => {
    setExtras(extras.filter((_, idx) => idx !== index))
  }

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      {!hideEnabledToggle && (
        <label className="flex items-center justify-between gap-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              {accountDefaults ? 'Ưu tiên bài Telegram khi tạo mới' : 'Bật Telegram cho bài viết này'}
            </span>
            <span className="mt-1 block text-xs text-gray-600">
              {accountDefaults
                ? 'Ghi nhớ loại ưu tiên cho tài khoản và bài tạo qua API chưa chọn loại. Trong dashboard, hai nút tạo vẫn quyết định loại bài.'
                : 'Video/ảnh vẫn xem ngay trên bài, không bắt vào Telegram.'}
            </span>
          </span>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
            className="h-5 w-5 shrink-0 accent-sky-600"
          />
        </label>
      )}

      <label className="grid gap-1.5 text-sm font-medium text-gray-700">
        Link nhóm/kênh Telegram
        <input
          type="url"
          maxLength={2048}
          value={value.url}
          onChange={(event) => onChange({ ...value, url: event.target.value })}
          placeholder="https://t.me/ten_nhom hoặc https://t.me/+..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
        />
        <span className="text-xs font-normal text-gray-500">
          Lưu link để dùng lại. Bài bật Telegram cần có link nhóm/kênh hợp lệ.
        </span>
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-gray-700">
        Chữ trên nút Telegram
        <input
          maxLength={120}
          value={value.buttonText}
          onChange={(event) => onChange({ ...value, buttonText: event.target.value })}
          placeholder="✈️ VÀO NHÓM TELEGRAM NGAY"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
        />
      </label>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-slate-50/70 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Các nút bấm phụ ({extras.length}/6)
            </div>
            <p className="text-xs text-gray-500">
              Thêm nhiều link Telegram khác hoặc nút tải App Mê Sale hiển thị ngay bên dưới nút chính.
            </p>
          </div>

          {extras.length < 6 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => addExtraButton()}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm link
              </button>
              <button
                type="button"
                onClick={() =>
                  addExtraButton({
                    url: 'https://mesale.vn',
                    buttonText: '📲 TẢI APP MÊ SALE NGAY',
                    color: 'orange',
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Nút tải App Mê Sale
              </button>
            </div>
          )}
        </div>

        {extras.length > 0 && (
          <div className="space-y-3">
            {extras.map((btn, idx) => (
              <div
                key={idx}
                className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-600">Nút phụ #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExtraButton(idx)}
                    aria-label={`Xóa nút phụ ${idx + 1}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-[1fr_170px]">
                  <input
                    maxLength={120}
                    value={btn.buttonText}
                    onChange={(e) => updateExtraButton(idx, { buttonText: e.target.value })}
                    placeholder="Chữ trên nút (VD: 📲 TẢI APP MÊ SALE NGAY)"
                    aria-label={`Chữ trên nút phụ ${idx + 1}`}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={btn.color || 'telegram'}
                    onChange={(e) =>
                      updateExtraButton(idx, { color: e.target.value as TelegramButtonColor })
                    }
                    aria-label={`Màu nút phụ ${idx + 1}`}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-medium text-gray-700"
                  >
                    {COLOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="url"
                  maxLength={2048}
                  value={btn.url}
                  onChange={(e) => updateExtraButton(idx, { url: e.target.value })}
                  placeholder="https://mesale.vn/... hoặc https://t.me/..."
                  aria-label={`Link nút phụ ${idx + 1}`}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="grid gap-1.5 text-sm font-medium text-gray-700">
        Đoạn chữ dưới nút / Miễn trừ trách nhiệm
        <textarea
          rows={5}
          maxLength={4000}
          value={value.disclaimer}
          onChange={(event) => onChange({ ...value, disclaimer: event.target.value })}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
          placeholder="Nội dung thông báo hiển thị giữa nút Telegram và video/ảnh..."
        />
        <span className="text-xs font-normal text-gray-500">
          Hiển thị dạng văn bản, giữ xuống dòng; để trống nếu không cần đoạn chữ.
        </span>
      </label>
    </fieldset>
  )
}
