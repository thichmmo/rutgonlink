'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Link2, Copy, Check, Loader2 } from 'lucide-react'

export default function DashboardQuickShorten() {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError('')
    setShortUrl('')

    try {
      const res = await apiFetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: url }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      const base = window.location.origin
      setShortUrl(`${base}/${data.shortCode}`)
      setUrl('')
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-sky-600 to-sky-800 rounded-2xl p-4 sm:p-6 text-white">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <Link2 className="w-5 h-5" />
        Rút gọn link nhanh
      </h2>
      <p className="text-sky-200 text-sm mb-4">Tạo link ngắn ngay tại đây</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          type="text"
          placeholder="Dán URL dài vào đây..."
          className="flex-1 min-w-0 px-4 py-2.5 bg-white/20 border border-white/30 rounded-xl text-white placeholder-sky-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-white text-sky-600 font-semibold text-sm rounded-xl hover:bg-sky-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Rút gọn
        </button>
      </form>
      {error && <p className="mt-2 text-red-200 text-sm">{error}</p>}
      {shortUrl && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-white/20 rounded-xl px-4 py-2.5">
          <span className="flex-1 min-w-0 text-sm font-medium break-all">{shortUrl}</span>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1 text-xs bg-white text-sky-600 px-3 py-1.5 rounded-lg font-medium hover:bg-sky-50 transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Đã sao chép' : 'Sao chép'}
          </button>
        </div>
      )}
    </div>
  )
}
