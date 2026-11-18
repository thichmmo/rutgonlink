'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import {
  DASHBOARD_NAV_EVENT,
  defaultDashboardNavVisibility,
  OPTIONAL_DASHBOARD_NAV_META,
  type DashboardNavVisibility,
  type OptionalDashboardNavKey,
} from '@/lib/dashboard-nav-visibility'

export default function MenuVisibilitySection({
  initialVisibility,
}: {
  initialVisibility?: DashboardNavVisibility
}) {
  const [visibility, setVisibility] = useState<DashboardNavVisibility>(
    () => initialVisibility ?? defaultDashboardNavVisibility(),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const broadcast = (next: DashboardNavVisibility) => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_NAV_EVENT, { detail: next }))
  }

  const applyPatch = async (patch: Partial<DashboardNavVisibility>, successText: string) => {
    const previous = visibility
    const optimistic: DashboardNavVisibility = { ...visibility, ...patch }
    setVisibility(optimistic)
    broadcast(optimistic)
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) {
        setVisibility(previous)
        broadcast(previous)
        setMessage({ text: data.error || 'Không thể lưu tùy chọn menu', type: 'error' })
        return
      }
      setVisibility(data.visibility)
      broadcast(data.visibility)
      setMessage({ text: successText, type: 'success' })
    } catch {
      setVisibility(previous)
      broadcast(previous)
      setMessage({ text: 'Không thể kết nối máy chủ', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleItem = (key: OptionalDashboardNavKey, label: string) => {
    const nextValue = !visibility[key]
    void applyPatch(
      { [key]: nextValue },
      nextValue ? `Đã hiện mục "${label}" trên thanh menu.` : `Đã ẩn mục "${label}" khỏi thanh menu.`,
    )
  }

  const hideAllOptional = () => {
    void applyPatch(
      { links: false, folders: false, analytics: false, notes: false, fbDebug: false },
      'Đã bật chế độ gọn (ẩn Links, Folders, Thống kê, Ghi chú, FB Debug).',
    )
  }

  const showAllOptional = () => {
    void applyPatch(
      { links: true, folders: true, analytics: true, notes: true, fbDebug: true },
      'Đã hiển thị lại đầy đủ các mục trên thanh menu.',
    )
  }

  const allHidden = OPTIONAL_DASHBOARD_NAV_META.every((item) => !visibility[item.key])
  const allShown = OPTIONAL_DASHBOARD_NAV_META.every((item) => visibility[item.key])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-sky-600" />
            Hiển thị thanh Menu
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Tắt bớt các tính năng bạn không dùng để thanh menu gọn gàng hơn. Các mục chính (Tổng quan, TikTok AFF, Popups, Bài viết, Ghép ảnh, Cài đặt) luôn được giữ lại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || allHidden}
            onClick={hideAllOptional}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-45 cursor-pointer"
          >
            Ẩn gọn cả 5 mục
          </button>
          <button
            type="button"
            disabled={saving || allShown}
            onClick={showAllOptional}
            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-45 cursor-pointer"
          >
            Hiện tất cả
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {OPTIONAL_DASHBOARD_NAV_META.map((item) => {
          const checked = visibility[item.key]
          return (
            <div key={item.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={`Hiển thị ${item.label}`}
                disabled={saving}
                onClick={() => toggleItem(item.key, item.label)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                  checked ? 'bg-sky-600' : 'bg-gray-200'
                } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    checked ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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
