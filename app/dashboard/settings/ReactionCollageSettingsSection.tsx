'use client'

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, RotateCcw, Sparkles, Upload } from 'lucide-react'
import {
  COLLAGE_ASPECT_LABELS,
  COLLAGE_ASPECT_PRESETS,
  DEFAULT_REACTION_TEMPLATE_URL,
  REACTION_CORNER_LABELS,
  REACTION_CORNERS,
  type CollageAspectPreset,
  type ReactionCorner,
  type UserCollageSettings,
} from '@/lib/reaction-collage-config'

const SCALE_PRESETS = [
  { value: 22, label: 'Nhỏ (22%)' },
  { value: 28, label: 'Vừa (28%)' },
  { value: 34, label: 'Lớn (34%)' },
]

export default function ReactionCollageSettingsSection({
  initialSettings,
  canUseFbViral,
}: {
  initialSettings: UserCollageSettings
  canUseFbViral: boolean
}) {
  const [settings, setSettings] = useState<UserCollageSettings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const savePatch = async (patch: Partial<UserCollageSettings>, successText: string) => {
    const previous = settings
    const optimistic = { ...settings, ...patch }
    setSettings(optimistic)
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/collage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        setSettings(previous)
        setMessage({ text: data.error || 'Không thể lưu cài đặt ghép ảnh', type: 'error' })
        return
      }
      setSettings(data.settings)
      setMessage({ text: successText, type: 'success' })
    } catch {
      setSettings(previous)
      setMessage({ text: 'Không thể kết nối máy chủ', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const uploadTemplate = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Vui lòng chọn tệp hình ảnh hợp lệ.', type: 'error' })
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/settings/collage', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ text: data.error || 'Tải ảnh mẫu thất bại', type: 'error' })
        return
      }
      setSettings(data.settings)
      setMessage({ text: 'Đã cập nhật ảnh mẫu Reaction cố định.', type: 'success' })
    } catch {
      setMessage({ text: 'Không thể tải ảnh mẫu lên máy chủ', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const isDefaultTemplate = settings.templateImageUrl === DEFAULT_REACTION_TEMPLATE_URL

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-sky-600" />
            Mẫu ghép ảnh Reaction cố định
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Cài 1 ảnh cố định duy nhất — khi bật, mọi ảnh dán hoặc upload ở mục{' '}
            <Link href="/dashboard/collage" className="text-sky-600 font-medium hover:underline">
              Ghép ảnh
            </Link>{' '}
            sẽ tự động đè khung cam FaceTime/TikTok Reaction vào góc.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Tự động ghép ảnh mẫu"
          disabled={saving || uploading}
          onClick={() =>
            void savePatch(
              { enabled: !settings.enabled },
              !settings.enabled ? 'Đã bật tự động ghép ảnh mẫu.' : 'Đã tắt tự động ghép ảnh mẫu.',
            )
          }
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
            settings.enabled ? 'bg-sky-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-[150px_minmax(0,1fr)] items-start">
        <div className="space-y-2">
          <div className="relative mx-auto w-[132px] aspect-[3/4] overflow-hidden rounded-2xl border-2 border-white shadow-md ring-1 ring-gray-200 bg-gray-100">
            <img
              src={settings.templateImageUrl}
              alt="Ảnh mẫu Reaction cố định"
              className="h-full w-full object-cover object-top"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void uploadTemplate(f)
            }}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading || saving}
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Đang tải...' : 'Đổi ảnh mẫu'}
          </button>
          {!isDefaultTemplate && (
            <button
              type="button"
              disabled={uploading || saving}
              onClick={() =>
                void savePatch(
                  { templateImageUrl: DEFAULT_REACTION_TEMPLATE_URL },
                  'Đã khôi phục ảnh mẫu mặc định.',
                )
              }
              className="w-full inline-flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium text-sky-600 hover:bg-sky-50 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Dùng ảnh mặc định
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Vị trí góc mặc định
            </label>
            <div className="flex flex-wrap gap-2">
              {REACTION_CORNERS.map((corner: ReactionCorner) => (
                <button
                  key={corner}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void savePatch(
                      { corner },
                      `Đã đặt góc mặc định: ${REACTION_CORNER_LABELS[corner]}.`,
                    )
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                    settings.corner === corner
                      ? 'border-sky-600 bg-sky-50 text-sky-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {REACTION_CORNER_LABELS[corner]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Kích thước khung Reaction
            </label>
            <div className="flex flex-wrap gap-2">
              {SCALE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void savePatch(
                      { scalePercent: preset.value },
                      `Đã đặt kích thước khung: ${preset.label}.`,
                    )
                  }
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                    settings.scalePercent === preset.value
                      ? 'border-sky-600 bg-sky-50 text-sky-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {canUseFbViral && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Tối ưu thông số chuẩn đề xuất Facebook
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.fbViralEnabled}
                  disabled={saving}
                  onClick={() =>
                    void savePatch(
                      { fbViralEnabled: !settings.fbViralEnabled },
                      !settings.fbViralEnabled
                        ? 'Đã bật chế độ tối ưu chuẩn đề xuất Facebook.'
                        : 'Đã tắt chế độ tối ưu chuẩn đề xuất Facebook.',
                    )
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    settings.fbViralEnabled ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.fbViralEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {settings.fbViralEnabled && (
                <div className="flex flex-wrap gap-1.5">
                  {COLLAGE_ASPECT_PRESETS.map((preset: CollageAspectPreset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void savePatch(
                          { aspectPreset: preset },
                          `Đã chọn khung xuất: ${COLLAGE_ASPECT_LABELS[preset]}.`,
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                        settings.aspectPreset === preset
                          ? 'border-amber-600 bg-white text-amber-900 shadow-xs'
                          : 'border-amber-200/80 bg-transparent text-amber-800/80 hover:bg-white/60'
                      }`}
                    >
                      {COLLAGE_ASPECT_LABELS[preset]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
