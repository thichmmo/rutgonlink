'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminLoading } from '../_components/AdminUi'

type OAuthStatus = {
  configured: boolean
  source: 'database' | 'environment' | 'none'
  clientId: string
  hasStoredSecret: boolean
  googleCallback: string
  driveCallback: string
  canWrite: boolean
}

export default function AdminOAuthPage() {
  const [data, setData] = useState<OAuthStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [reason, setReason] = useState('Cập nhật Google OAuth production')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    const response = await fetch('/api/admin/oauth/google', {
      cache: 'no-store',
    })
    const json = await response.json()
    if (!response.ok) {
      setError(json.error || 'Không tải được Google OAuth')
      return
    }
    setData(json)
    setClientId(json.clientId || '')
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    const response = await fetch('/api/admin/oauth/google', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, reason }),
    })
    const json = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(json.error || 'Không thể lưu Google OAuth')
      return
    }
    setData((current) => ({ ...json, canWrite: current?.canWrite ?? false }))
    setClientSecret('')
    setMessage('Đã lưu. Provider Google có hiệu lực ngay.')
  }

  const clearOverride = async () => {
    setSaving(true)
    setError('')
    const response = await fetch('/api/admin/oauth/google', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const json = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(json.error || 'Không thể xóa cấu hình')
      return
    }
    setData((current) => ({ ...json, canWrite: current?.canWrite ?? false }))
    setClientId(json.clientId || '')
    setClientSecret('')
    setClearing(false)
    setMessage(
      json.configured
        ? 'Đã quay về cấu hình environment.'
        : 'Đã tắt Google OAuth.',
    )
  }

  if (!data && !error) return <AdminLoading />
  if (!data) return <div className="text-red-300">{error}</div>

  const sourceLabel =
    data.source === 'database'
      ? 'Admin database'
      : data.source === 'environment'
        ? 'Environment fallback'
        : 'Chưa cấu hình'

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Google OAuth</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cấu hình đăng nhập Google và đồng bộ Google Drive.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminBadge
            value={data.configured ? 'active' : 'error'}
            label={data.configured ? 'Đang bật' : 'Đang tắt'}
          />
          <span className="text-xs text-gray-500">{sourceLabel}</span>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-white">OAuth credentials</h2>
          </div>
          <div className="space-y-4">
            <label className="block text-sm text-gray-400">
              Google Client ID
              <input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                disabled={!data.canWrite}
                placeholder="123456789-abc.apps.googleusercontent.com"
                className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-white outline-none focus:border-red-500 disabled:opacity-50"
              />
            </label>
            <label className="block text-sm text-gray-400">
              Google Client Secret
              <input
                type="password"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                disabled={!data.canWrite}
                autoComplete="new-password"
                placeholder={
                  data.hasStoredSecret
                    ? 'Để trống để giữ secret hiện tại'
                    : 'GOCSPX-...'
                }
                className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-white outline-none focus:border-red-500 disabled:opacity-50"
              />
            </label>
            <label className="block text-sm text-gray-400">
              Lý do thay đổi
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={!data.canWrite}
                className="mt-1 min-h-20 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-white outline-none focus:border-red-500 disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {data.source === 'database' && data.canWrite && (
              <button
                onClick={() => setClearing(true)}
                className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300"
              >
                <Trash2 className="mr-1 inline h-4 w-4" />
                Xóa override
              </button>
            )}
            <button
              disabled={
                !data.canWrite ||
                saving ||
                reason.trim().length < 3 ||
                !clientId.endsWith('.apps.googleusercontent.com')
              }
              onClick={save}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Đang lưu...' : 'Lưu OAuth'}
            </button>
          </div>
          {!data.canWrite && (
            <p className="mt-3 text-right text-xs text-amber-400">
              Chỉ owner được thay đổi credentials.
            </p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Bảo mật
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>Client Secret được mã hóa AES-256-GCM.</li>
              <li>Secret không hiển thị lại và bị redact khỏi audit.</li>
              <li>Thay credentials có thể yêu cầu user kết nối lại Drive.</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="font-semibold text-white">
              Redirect URI trên Google Cloud
            </h2>
            <div className="mt-3 space-y-3 text-xs text-gray-400">
              {[data.googleCallback, data.driveCallback].map((url) => (
                <code
                  key={url}
                  className="block break-all rounded-lg bg-gray-950 p-3"
                >
                  {url}
                </code>
              ))}
            </div>
            {data.configured && (
              <button
                onClick={() =>
                  window.location.assign('/api/auth/signin/google')
                }
                className="mt-4 inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
              >
                <ExternalLink className="h-4 w-4" />
                Thử đăng nhập Google
              </button>
            )}
          </section>
        </aside>
      </div>

      {clearing && (
        <AdminDialog
          title="Xóa Google OAuth override"
          onClose={() => setClearing(false)}
        >
          <p className="text-sm text-amber-300">
            Hệ thống sẽ quay về biến môi trường. Nếu environment không có
            credentials, đăng nhập Google và Drive sẽ tắt.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setClearing(false)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm"
            >
              Hủy
            </button>
            <button
              disabled={saving || reason.trim().length < 3}
              onClick={clearOverride}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Xác nhận xóa
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  )
}
