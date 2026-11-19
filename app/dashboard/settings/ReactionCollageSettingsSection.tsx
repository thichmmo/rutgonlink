'use client'

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, RotateCcw, Upload } from 'lucide-react'
import {
  DEFAULT_REACTION_TEMPLATE_URL,
  REACTION_CORNER_LABELS,
  REACTION_CORNERS,
  type ReactionCorner,
  type UserCollageSettings,
} from '@/lib/reaction-collage-config'

const SCALE_PRESETS = [
  { value: 30, label: 'Nhỏ (30%)' },
  { value: 38, label: 'Vừa (38%)' },
  { value: 46, label: 'Lớn (46%)' },
]

const MEDIAPIPE_VISION_ESM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm'
const MEDIAPIPE_VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
const SELFIE_SEGMENTER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

type VisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>
  }
  ImageSegmenter: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string }
        runningMode: 'IMAGE'
        outputConfidenceMasks: boolean
        outputCategoryMask: boolean
      },
    ) => Promise<{
      segment: (
        image: HTMLCanvasElement,
        callback: (result: {
          confidenceMasks?: Array<{ getAsFloat32Array: () => Float32Array }>
          close?: () => void
        }) => void,
      ) => void
      close: () => void
    }>
  }
}

async function autoCutoutPortraitFile(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file

  const bitmapUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh tải lên'))
      el.src = bitmapUrl
    })

    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return file

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)

    // Preserve already-transparent PNG/WebP cutouts untouched without re-segmenting.
    const imageData = ctx.getImageData(0, 0, w, h)
    const pixels = imageData.data
    let hasTransparency = false
    for (let i = 3; i < pixels.length; i += 16) {
      if (pixels[i] < 245) {
        hasTransparency = true
        break
      }
    }
    if (hasTransparency) return file

    // Dynamic remote import keeps Next.js/Turbopack bundle free of WASM/TFLite assets.
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<VisionModule>
    const vision = await dynamicImport(MEDIAPIPE_VISION_ESM)
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM)
    const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SELFIE_SEGMENTER_MODEL },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })

    try {
      let personMask: Float32Array | null = null
      segmenter.segment(canvas, (result) => {
        const masks = result.confidenceMasks
        const target = masks && masks.length > 1 ? masks[1] : masks?.[0]
        if (target) personMask = new Float32Array(target.getAsFloat32Array())
        result.close?.()
      })
      if (!personMask) return file

      const maskArray: Float32Array = personMask
      if (maskArray.length !== w * h) return file

      // Require enough foreground area so scenic non-portrait uploads do not get wiped out.
      let foregroundCount = 0
      for (let i = 0; i < maskArray.length; i++) {
        if (maskArray[i] > 0.45) foregroundCount++
      }
      if (foregroundCount < w * h * 0.05) return file

      for (let i = 0; i < maskArray.length; i++) {
        const soft = Math.max(0, Math.min(1, (maskArray[i] - 0.35) / 0.35))
        pixels[i * 4 + 3] = Math.round(soft * 255)
      }
      ctx.putImageData(imageData, 0, 0)

      const cutoutBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/png'),
      )
      if (!cutoutBlob) return file

      const stem = file.name.replace(/\.[^.]+$/, '') || 'reaction-template'
      return new File([cutoutBlob], `${stem}.png`, { type: 'image/png' })
    } finally {
      segmenter.close()
    }
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(bitmapUrl)
  }
}

export default function ReactionCollageSettingsSection({
  initialSettings,
}: {
  initialSettings: UserCollageSettings
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
      const preparedFile = await autoCutoutPortraitFile(file)
      const form = new FormData()
      form.append('file', preparedFile)
      const res = await fetch('/api/settings/collage', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ text: data.error || 'Tải ảnh mẫu thất bại', type: 'error' })
        return
      }
      setSettings(data.settings)
      setMessage({ text: 'Đã cập nhật ảnh mẫu tách nền cố định.', type: 'success' })
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
            Cài 1 ảnh người tách nền cố định — khi bật, mọi ảnh dán hoặc upload ở mục{' '}
            <Link href="/dashboard/collage" className="text-sky-600 font-medium hover:underline">
              Ghép ảnh
            </Link>{' '}
            sẽ tự động ghép sát vào góc dưới ảnh.
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

      <div className="grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)] items-start">
        <div className="space-y-2">
          <div className="relative mx-auto h-[116px] w-[104px] overflow-hidden rounded-2xl border border-gray-200 bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
            <img
              src={settings.templateImageUrl}
              alt="Ảnh mẫu Reaction cố định"
              className="h-full w-full object-contain object-bottom"
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
            {uploading ? 'Đang tách nền...' : 'Đổi ảnh mẫu'}
          </button>
          {!isDefaultTemplate && (
            <button
              type="button"
              disabled={uploading || saving}
              onClick={() =>
                void savePatch(
                  { templateImageUrl: DEFAULT_REACTION_TEMPLATE_URL },
                  'Đã khôi phục ảnh mẫu tách nền mặc định.',
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
              Kích thước người ghép
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
                      `Đã đặt kích thước người ghép: ${preset.label}.`,
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
