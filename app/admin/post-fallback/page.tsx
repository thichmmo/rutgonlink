'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  CornerDownRight,
  ExternalLink,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { AdminBadge, AdminLoading } from '../_components/AdminUi'

type AdminPostOption = {
  id: string
  title: string
  slug: string
  publicUrl: string
  isDirectWrapper: boolean
  popupName: string | null
}

type FallbackInspection = {
  mode: 'unconfigured' | 'post' | 'redirect' | 'missing_post'
  post: AdminPostOption | null
}

type FallbackPayload = {
  enabled: boolean
  targetUrl: string
  updatedAt: string | null
  updatedBy: string | null
  canWrite: boolean
  inspection: FallbackInspection
  adminPosts?: AdminPostOption[]
}

export default function AdminPostFallbackPage() {
  const [data, setData] = useState<FallbackPayload | null>(null)
  const [adminPosts, setAdminPosts] = useState<AdminPostOption[]>([])
  const [enabled, setEnabled] = useState(false)
  const [targetUrl, setTargetUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    const response = await fetch('/api/admin/post-fallback', { cache: 'no-store' })
    const json = await response.json()
    if (!response.ok) {
      setError(json.error || 'Không tải được cấu hình hứng link cũ')
      return
    }
    setData(json)
    setEnabled(Boolean(json.enabled))
    setTargetUrl(json.targetUrl || '')
    setAdminPosts(json.adminPosts || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/post-fallback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, targetUrl }),
      })
      const json = await response.json()
      if (!response.ok) {
        setError(json.error || 'Không thể lưu cấu hình hứng link cũ')
        return
      }
      setData((current) => ({ ...json, adminPosts: current?.adminPosts }))
      setEnabled(Boolean(json.enabled))
      setTargetUrl(json.targetUrl || '')
      setMessage(
        json.enabled
          ? 'Đã lưu và bật hứng link bài viết cũ trên toàn hệ thống.'
          : 'Đã lưu trạng thái tắt hứng link bài viết cũ.',
      )
    } catch {
      setError('Lỗi kết nối khi lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  if (!data && !error) return <AdminLoading />
  if (!data) return <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>

  const inspection = data.inspection

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Hứng link bài viết cũ</h1>
          <p className="mt-1 text-sm text-gray-400">
             Xử lý ngầm ở backend cho toàn bộ link <code className="text-gray-300">/p7/mã-số</code> và{' '}
            <code className="text-gray-300">/posts/slug</code> đã xóa hoặc không tồn tại trên cả hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminBadge
            value={data.enabled ? 'active' : 'cancelled'}
            label={data.enabled ? 'Đang bật toàn hệ thống' : 'Đang tắt'}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3.5">
            <div>
              <div className="text-sm font-semibold text-white">Kích hoạt hứng link cũ toàn hệ thống</div>
              <div className="mt-0.5 text-xs text-gray-400">
                Khi bật, mọi bài viết cũ đã bị xóa của bất kỳ tài khoản nào sẽ tự đổ về link đích bên dưới.
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!data.canWrite}
                onChange={(event) => setEnabled(event.target.checked)}
                className="h-5 w-5 accent-red-600"
              />
              <span className="text-sm font-semibold text-gray-200">
                {enabled ? 'Bật' : 'Tắt'}
              </span>
            </label>
          </div>

          <label className="block text-sm text-gray-300">
            Link đích của Admin (bài <code className="text-gray-400">/p7/...</code> nội bộ hoặc URL ngoài bất kỳ)
            <input
              type="text"
              value={targetUrl}
              disabled={!data.canWrite}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://ca33newss.xyz/p7/37325 hoặc https://..."
              className="mt-1.5 w-full rounded-xl border border-gray-700 bg-gray-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500 disabled:opacity-50"
            />
          </label>

          {adminPosts.length > 0 && data.canWrite && (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Chọn nhanh bài viết / Bọc thẳng đang bật của Admin
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {adminPosts.map((post) => {
                  const isSelected = targetUrl.trim() === post.publicUrl
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => {
                        setTargetUrl(post.publicUrl)
                        setEnabled(true)
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition ${
                        isSelected
                          ? 'border-red-500/60 bg-red-950/30 text-white'
                          : 'border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">
                          {post.isDirectWrapper && (
                            <span className="mr-1.5 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              Bọc thẳng
                            </span>
                          )}
                          {post.title}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-gray-500">
                          {post.publicUrl}
                          {post.popupName ? ` · Popup: ${post.popupName}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-red-400">
                        {isSelected ? 'Đang chọn' : 'Chọn'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-gray-500">
              {data.updatedAt
                ? `Cập nhật lần cuối: ${new Date(data.updatedAt).toLocaleString('vi-VN')}${data.updatedBy ? ` (${data.updatedBy})` : ''}`
                : 'Chưa có cấu hình nào được lưu.'}
            </div>
            <button
              type="button"
              disabled={!data.canWrite || saving || (enabled && !targetUrl.trim())}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <CornerDownRight className="h-5 w-5 text-emerald-400" />
              Trạng thái xử lý hiện tại
            </h2>
            <div className="mt-3 space-y-2.5 text-sm text-gray-300">
              {!data.enabled ? (
                <p className="text-gray-400">
                  Đang tắt: các link <code className="text-gray-300">/p7/...</code> và{' '}
                  <code className="text-gray-300">/posts/...</code> không tồn tại sẽ trả về trang <code className="text-gray-300">404</code> như mặc định.
                </p>
              ) : inspection.mode === 'post' && inspection.post ? (
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Mở trực tiếp bài nội bộ + chạy Popup của Admin
                  </div>
                  <div className="mt-2 font-medium text-white">{inspection.post.title}</div>
                  <div className="mt-1 break-all text-xs text-gray-400">{inspection.post.publicUrl}</div>
                  {inspection.post.popupName && (
                    <div className="mt-1 text-xs text-amber-300">Popup đang gắn: {inspection.post.popupName}</div>
                  )}
                  <a
                    href={inspection.post.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở thử link đích
                  </a>
                </div>
              ) : inspection.mode === 'redirect' ? (
                <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-3.5">
                  <div className="text-xs font-semibold text-sky-400">Chuyển hướng 302 thẳng sang URL đích</div>
                  <div className="mt-1.5 break-all text-xs text-gray-300">{data.targetUrl}</div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3.5 text-xs text-amber-300">
                  Bài viết nội bộ đích hiện không tồn tại hoặc đang ở trạng thái nháp; hệ thống sẽ trả 404 an toàn thay vì lặp redirect.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
              Cơ chế Backend
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-400">
              <li>Ẩn 100% với người dùng thường: Dashboard không hiển thị bất kỳ nút hay thông tin nào về tính năng này.</li>
              <li>Chỉ áp dụng cho bài viết (<code className="text-gray-300">/p7/mã-số</code> và <code className="text-gray-300">/posts/slug</code>) đã bị xóa hoặc không tồn tại; các bài đang sống vẫn mở bình thường.</li>
              <li>Nếu chọn bài nội bộ của Admin, khách mở link cũ trên điện thoại sẽ chạy thẳng Popup Shopee → TikTok và tính click về tài khoản Admin.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
