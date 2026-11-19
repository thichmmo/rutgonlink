'use client'

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ImagePlus,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  MAX_COLLAGE_HISTORY,
  REACTION_CORNER_LABELS,
  REACTION_CORNERS,
  type CollageHistoryItem,
  type ReactionCorner,
  type UserCollageSettings,
} from '@/lib/reaction-collage-config'

const SCALE_OPTIONS = [
  { value: 30, label: 'Nhỏ' },
  { value: 38, label: 'Vừa' },
  { value: 46, label: 'Lớn' },
]

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fetchUrlAsPngBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Không tải được ảnh để sao chép')
  const blob = await response.blob()
  if (blob.type === 'image/png') return blob

  // Browsers universally accept image/png in ClipboardItem; convert JPEG/WebP via offscreen canvas.
  return new Promise<Blob>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Không tạo được bộ đệm ảnh'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (pngBlob) => {
            URL.revokeObjectURL(objectUrl)
            if (pngBlob) resolve(pngBlob)
            else reject(new Error('Không thể chuyển ảnh sang định dạng Clipboard'))
          },
          'image/png',
        )
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Không đọc được ảnh kết quả'))
    }
    img.src = objectUrl
  })
}

export default function ReactionCollageStudio({
  initialSettings,
  initialItems,
}: {
  initialSettings: UserCollageSettings
  initialItems: CollageHistoryItem[]
}) {
  const [settings, setSettings] = useState<UserCollageSettings>(initialSettings)
  const [items, setItems] = useState<CollageHistoryItem[]>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(initialItems[0]?.id ?? null)
  const [processing, setProcessing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSourceFileRef = useRef<File | null>(null)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  const activeItem = items.find((entry) => entry.id === activeId) ?? items[0] ?? null

  const submitCollage = useCallback(
    async (
      file: File,
      overrides?: {
        corner?: ReactionCorner
        scalePercent?: number
      },
    ) => {
      if (!file.type.startsWith('image/')) {
        setNotice({ text: 'Tệp vừa chọn không phải hình ảnh hợp lệ.', type: 'error' })
        return
      }
      lastSourceFileRef.current = file
      setProcessing(true)
      setNotice(null)

      const nextCorner = overrides?.corner ?? settings.corner
      const nextScale = overrides?.scalePercent ?? settings.scalePercent

      try {
        const form = new FormData()
        form.append('file', file)
        form.append('corner', nextCorner)
        form.append('scalePercent', String(nextScale))

        const response = await fetch('/api/collage', { method: 'POST', body: form })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Ghép ảnh thất bại')
        }
        setItems(data.items || [])
        if (data.item?.id) setActiveId(data.item.id)
        setNotice({ text: 'Đã ghép ảnh hoàn tất!', type: 'success' })
      } catch (err) {
        setNotice({
          text: err instanceof Error ? err.message : 'Không thể xử lý ảnh lúc này',
          type: 'error',
        })
      } finally {
        setProcessing(false)
      }
    },
    [settings.corner, settings.scalePercent],
  )

  // Support clicking the "Dán ảnh" button directly without pressing Ctrl+V.
  const handlePasteButtonClick = async () => {
    if (processing) return
    setNotice(null)

    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      setNotice({
        text: 'Trình duyệt hiện tại không hỗ trợ đọc ảnh trực tiếp từ nút bấm. Bạn hãy chọn nút "Upload ảnh" nhé.',
        type: 'error',
      })
      return
    }

    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const clipItem of clipboardItems) {
        const imageType = clipItem.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          const blob = await clipItem.getType(imageType)
          const ext = imageType.split('/')[1] || 'png'
          const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imageType })
          await submitCollage(file)
          return
        }
      }
      setNotice({
        text: 'Trong bộ nhớ tạm hiện chưa có hình ảnh nào. Hãy sao chép (Copy) một bức ảnh trước rồi nhấn "Dán ảnh".',
        type: 'info',
      })
    } catch {
      setNotice({
        text: 'Chưa đọc được bộ nhớ tạm — hãy bấm "Cho phép" (Allow) khi trình duyệt hỏi quyền dán, hoặc dùng nút "Upload ảnh".',
        type: 'error',
      })
    }
  }

  // Also accept window paste events when the user happens to paste directly on the page.
  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (processing) return
      const files = event.clipboardData?.files
      if (!files?.length) return
      const image = [...files].find((file) => file.type.startsWith('image/'))
      if (!image) return
      event.preventDefault()
      void submitCollage(image)
    }
    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [processing, submitCollage])

  const updateQuickSetting = async (patch: Partial<UserCollageSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    fetch('/api/settings/collage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})

    // Re-compose the current session's pasted/uploaded image immediately when tweaking corner or size.
    if (lastSourceFileRef.current && !processing) {
      await submitCollage(lastSourceFileRef.current, next)
    }
  }

  const copyImage = async (item: CollageHistoryItem) => {
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        throw new Error('Trình duyệt không hỗ trợ sao chép ảnh trực tiếp; hãy nhấn "Tải ảnh về".')
      }
      // Pass a Promise<Blob> directly inside ClipboardItem so Safari/iOS preserves user activation.
      const clipboardItem = new window.ClipboardItem({
        'image/png': fetchUrlAsPngBlob(item.url),
      })
      await navigator.clipboard.write([clipboardItem])
      setCopiedId(item.id)
      setNotice({ text: 'Đã copy ảnh vào bộ nhớ tạm! Bạn có thể dán thẳng lên Facebook ngay.', type: 'success' })
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId((current) => (current === item.id ? null : current))
      }, 2500)
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : 'Không thể copy tự động trên trình duyệt này, hãy nhấn "Tải ảnh về".',
        type: 'error',
      })
    }
  }

  const deleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/collage?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không thể xóa ảnh')
      const nextItems: CollageHistoryItem[] = data.items || []
      setItems(nextItems)
      if (activeId === id) setActiveId(nextItems[0]?.id ?? null)
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Xóa ảnh thất bại', type: 'error' })
    }
  }

  const clearAll = async () => {
    if (!items.length || !window.confirm('Xóa toàn bộ ảnh đã ghép gần đây khỏi tài khoản?')) return
    try {
      const res = await fetch('/api/collage?all=1', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không thể xóa lịch sử')
      setItems([])
      setActiveId(null)
      setNotice({ text: 'Đã dọn sạch danh sách ảnh gần đây.', type: 'info' })
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Không thể xóa lịch sử', type: 'error' })
    }
  }

  return (
    <div className="space-y-5 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ImagePlus className="w-6 h-6 text-sky-600" />
            Ghép ảnh Reaction
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Nhấn <b>Dán ảnh</b> hoặc <b>Upload ảnh</b> để tự động ghép ảnh người tách nền sát góc ảnh.
          </p>
        </div>

        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50"
        >
          <img
            src={settings.templateImageUrl}
            alt="Mẫu Reaction"
            className="h-6 w-6 rounded-md bg-slate-100 object-contain object-bottom ring-1 ring-gray-200"
          />
          <span>{settings.enabled ? 'Đang bật ghép tự động' : 'Đang tắt ghép mẫu'}</span>
          <Settings className="w-3.5 h-3.5 text-gray-400" />
        </Link>
      </div>

      {!settings.enabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>Chế độ tự động ghép ảnh mẫu đang tắt trong Cài đặt.</span>
          <button
            type="button"
            onClick={() => void updateQuickSetting({ enabled: true })}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer"
          >
            Bật lại ngay
          </button>
        </div>
      )}

      {/* Primary Action Zone: Paste Button + Upload Button + Quick Controls */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const dropped = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
          if (dropped && !processing) void submitCollage(dropped)
        }}
        className={`rounded-3xl border-2 transition-colors bg-white p-5 sm:p-6 shadow-xs ${
          dragging ? 'border-sky-500 bg-sky-50/40' : 'border-dashed border-gray-200'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            e.target.value = ''
            if (selected) void submitCollage(selected)
          }}
          className="hidden"
        />

        <div className="grid gap-3 sm:grid-cols-2 max-w-xl mx-auto">
          <button
            type="button"
            data-collage-paste-btn=""
            disabled={processing}
            onClick={() => void handlePasteButtonClick()}
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-4 text-base font-bold text-white shadow-sm hover:bg-sky-700 active:scale-[0.99] transition disabled:opacity-55 cursor-pointer"
          >
            <ClipboardPaste className="w-5 h-5" />
            {processing ? 'Đang ghép ảnh...' : 'Dán ảnh'}
          </button>

          <button
            type="button"
            data-collage-upload-btn=""
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-gray-200 bg-gray-50 px-6 py-4 text-base font-bold text-gray-800 hover:border-sky-300 hover:bg-sky-50/50 active:scale-[0.99] transition disabled:opacity-55 cursor-pointer"
          >
            <Upload className="w-5 h-5 text-sky-600" />
            Upload ảnh
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3">
          Sao chép ảnh bất kỳ rồi nhấn <b>Dán ảnh</b> (không cần bấm phím tắt), hoặc chọn <b>Upload ảnh</b> từ máy/điện thoại.
        </p>

        {/* Quick Corner & Size Controls */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 mr-1">Góc ghép:</span>
            {REACTION_CORNERS.map((corner) => (
              <button
                key={corner}
                type="button"
                disabled={processing}
                onClick={() => void updateQuickSetting({ corner })}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  settings.corner === corner
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {REACTION_CORNER_LABELS[corner]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 mr-1">Cỡ người:</span>
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={processing}
                onClick={() => void updateQuickSetting({ scalePercent: opt.value })}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  settings.scalePercent === opt.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : notice.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-sky-200 bg-sky-50 text-sky-800'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Compact Active Result Card */}
      {activeItem && (
        <div
          data-collage-active-card=""
          className="max-w-lg rounded-2xl border border-gray-200 bg-white p-3.5 sm:p-4 shadow-xs"
        >
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
            <div className="h-36 w-36 sm:h-40 sm:w-40 shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-1.5 flex items-center justify-center overflow-hidden">
              <img
                data-collage-active-preview=""
                src={activeItem.url}
                alt="Kết quả ghép ảnh"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <div className="text-sm font-bold text-gray-900">Ảnh vừa ghép</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {activeItem.width} × {activeItem.height}px · {formatBytes(activeItem.sizeBytes)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-collage-copy-btn=""
                  onClick={() => void copyImage(activeItem)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-black transition cursor-pointer"
                >
                  {copiedId === activeItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Đã copy ảnh
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy ảnh
                    </>
                  )}
                </button>

                <a
                  data-collage-download-btn=""
                  href={activeItem.url}
                  download={activeItem.downloadName}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition no-underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải ảnh về
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent 10 History */}
      <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              10 ảnh gần nhất ({items.length}/{MAX_COLLAGE_HISTORY})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Hệ thống tự động giữ tối đa {MAX_COLLAGE_HISTORY} ảnh mới nhất cho mỗi tài khoản và xóa ảnh cũ hơn để tối ưu dung lượng host.
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void clearAll()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa tất cả
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Chưa có ảnh nào được ghép. Hãy nhấn <b>Dán ảnh</b> hoặc <b>Upload ảnh</b> ở phía trên để bắt đầu!
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => {
              const selected = activeItem?.id === item.id
              return (
                <div
                  key={item.id}
                  className={`group flex flex-col overflow-hidden rounded-2xl border transition ${
                    selected ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className="h-28 w-full bg-gray-50 p-1 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={item.url}
                      alt={item.downloadName}
                      className="h-full w-full object-contain"
                    />
                  </button>

                  <div className="flex items-center justify-between gap-1 bg-white p-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => void copyImage(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 py-1.5 text-[11px] font-semibold text-gray-800 hover:bg-gray-200 cursor-pointer"
                      title="Copy ảnh"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy
                    </button>
                    <a
                      href={item.url}
                      download={item.downloadName}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-sky-50 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 no-underline"
                      title="Tải ảnh về"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải
                    </a>
                    <button
                      type="button"
                      onClick={() => void deleteItem(item.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      title="Xóa ảnh"
                      aria-label="Xóa ảnh"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
