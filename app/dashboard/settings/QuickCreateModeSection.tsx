'use client'

import { useState } from 'react'
import { Link2, Send, Zap } from 'lucide-react'
import {
  defaultDashboardQuickMode,
  type DashboardQuickMode,
} from '@/lib/dashboard-quick-mode'

const OPTIONS: Array<{
  value: DashboardQuickMode
  title: string
  description: string
  icon: typeof Link2
}> = [
  {
    value: 'shorten',
    title: 'Rút gọn link nhanh',
    description: 'Dán URL dài để tạo link rút gọn thông thường ngay đầu trang Tổng quan.',
    icon: Link2,
  },
  {
    value: 'telegram-post',
    title: 'Tạo nhanh bài Telegram (URL video / mã iframe)',
    description:
      'Dán URL video hoặc mã iframe để tạo ngay bài Telegram /p7/mã-số, tự dùng Popup gần nhất và xuất bản ngay.',
    icon: Send,
  },
]

export default function QuickCreateModeSection({
  initialMode,
}: {
  initialMode?: DashboardQuickMode
}) {
  const [mode, setMode] = useState<DashboardQuickMode>(
    () => initialMode ?? defaultDashboardQuickMode(),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const selectMode = async (nextMode: DashboardQuickMode) => {
    if (saving || nextMode === mode) return
    const previous = mode
    setMode(nextMode)
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/quick-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode }),
      })
      const data = await response.json()
      if (!response.ok) {
        setMode(previous)
        setMessage({ text: data.error || 'Không thể lưu chế độ tạo nhanh', type: 'error' })
        return
      }
      setMode(data.mode)
      setMessage({
        text:
          data.mode === 'telegram-post'
            ? 'Đã chuyển ô trên trang Tổng quan sang Tạo nhanh bài Telegram.'
            : 'Đã chuyển ô trên trang Tổng quan sang Rút gọn link nhanh.',
        type: 'success',
      })
    } catch {
      setMode(previous)
      setMessage({ text: 'Không thể kết nối máy chủ', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="quick-create-mode" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-sky-600" />
          Ô tạo nhanh ở trang Tổng quan
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Chọn chức năng cho khung màu xanh đầu trang Tổng quan: rút gọn link thường hoặc tạo nhanh bài viết Telegram bằng URL video / mã iframe.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Chế độ ô tạo nhanh ở trang Tổng quan">
        {OPTIONS.map((option) => {
          const active = mode === option.value
          const Icon = option.icon
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => void selectMode(option.value)}
              className={`text-left rounded-xl border p-4 transition-all cursor-pointer disabled:opacity-60 ${
                active
                  ? 'border-sky-500 bg-sky-50/70 ring-1 ring-sky-500'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Icon className={`w-4 h-4 ${active ? 'text-sky-600' : 'text-gray-500'}`} />
                  {option.title}
                </span>
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${
                    active ? 'border-sky-600 bg-sky-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-gray-600">{option.description}</p>
            </button>
          )
        })}
      </div>

      {message && (
        <div
          className={`mt-4 text-xs px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-sky-50 text-sky-700 border border-sky-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}
