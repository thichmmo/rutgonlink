'use client'

import { useState } from 'react'
import { Key, Copy, Eye, EyeOff, RefreshCw, Trash2, Check, ExternalLink } from 'lucide-react'

interface ApiKeySectionProps {
  initialApiKey: string | null
}

export default function ApiKeySection({ initialApiKey }: ApiKeySectionProps) {
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey)
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maskedKey = apiKey
    ? apiKey.slice(0, 10) + '••••••••••••••••••••••••••••••••'
    : null

  async function generateKey() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/api-key', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lỗi tạo API key')
      setApiKey(json.apiKey)
      setVisible(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi tạo API key')
    } finally {
      setLoading(false)
    }
  }

  async function revokeKey() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/api-key', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Lỗi thu hồi API key')
      }
      setApiKey(null)
      setVisible(false)
      setConfirmRevoke(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi thu hồi API key')
    } finally {
      setLoading(false)
    }
  }

  async function copyKey() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Key className="w-5 h-5 text-sky-600" />
        API Key
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        Dùng API key để tích hợp dịch vụ rút gọn link vào ứng dụng của bạn.{' '}
        <a
          href="/api-docs"
          target="_blank"
          className="text-sky-600 hover:underline inline-flex items-center gap-1"
        >
          Xem hướng dẫn API <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {apiKey ? (
        <div className="space-y-3">
          {/* Key display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-800 overflow-hidden">
              <span className="break-all sm:truncate">{visible ? apiKey : maskedKey}</span>
            </div>
            <button
              onClick={() => setVisible(!visible)}
              title={visible ? 'Ẩn key' : 'Hiện key'}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copyKey}
              title="Sao chép"
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-sky-600 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-sky-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
            <button
              onClick={generateKey}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Cấp lại key mới
            </button>

            {confirmRevoke ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-red-600">Xác nhận thu hồi?</span>
                <button
                  onClick={revokeKey}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Thu hồi
                </button>
                <button
                  onClick={() => setConfirmRevoke(false)}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRevoke(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border border-red-100 rounded-xl hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Thu hồi
              </button>
            )}
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
            Giữ bí mật API key — bất kỳ ai có key đều có thể tạo link dưới tài khoản của bạn. Nếu bị lộ, hãy cấp lại key ngay.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Bạn chưa có API key. Nhấn bên dưới để tạo.</p>
          <button
            onClick={generateKey}
            disabled={loading}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <Key className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'Đang tạo...' : 'Tạo API Key'}
          </button>
        </div>
      )}
    </div>
  )
}
