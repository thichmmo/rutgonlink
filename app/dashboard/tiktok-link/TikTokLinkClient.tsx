'use client'

import { FormEvent, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Music2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { apiFetch } from '@/lib/fetch'

interface TikTokLinkResult {
  shortUrl: string
  officialUrl: string
  convertedUrl: string
  productId: string
  title: string | null
}

type CopyTarget = 'official' | 'converted' | null

export default function TikTokLinkClient() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TikTokLinkResult | null>(null)
  const [copied, setCopied] = useState<CopyTarget>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const input = url.trim()
    if (!input) return

    setLoading(true)
    setError('')
    setResult(null)
    setCopied(null)

    try {
      const response = await apiFetch('/api/tiktok-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || 'Không thể chuyển đổi link TikTok')
        return
      }

      setResult(data as TikTokLinkResult)
    } catch {
      setError('Không thể kết nối tới server')
    } finally {
      setLoading(false)
    }
  }

  const copyUrl = async (value: string, target: Exclude<CopyTarget, null>) => {
    await navigator.clipboard.writeText(value)
    setCopied(target)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const reset = () => {
    setUrl('')
    setError('')
    setResult(null)
    setCopied(null)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gray-950 text-white flex items-center justify-center shadow-sm">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lấy link TikTok AFF</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mở rộng link TikTok rút gọn và tạo link đầy đủ dạng www/view/product.
            </p>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-gray-950 to-rose-500" />
        <div className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="tiktok-short-url" className="block text-sm font-semibold text-gray-800 mb-2">
                Link TikTok rút gọn
              </label>
              <div className="relative">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="tiktok-short-url"
                  type="url"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value)
                    setError('')
                  }}
                  placeholder="https://vt.tiktok.com/..."
                  autoComplete="off"
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-950 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music2 className="w-4 h-4" />}
                {loading ? 'Đang lấy link...' : 'Lấy link đầy đủ'}
              </button>
              {(url || result) && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Làm mới
                </button>
              )}
            </div>
          </form>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" />
                Đã mở rộng link thành công
              </div>
              <h2 className="mt-2 text-lg font-bold text-gray-900">
                {result.title || 'Sản phẩm TikTok Shop'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Product ID: <span className="font-mono text-gray-700">{result.productId}</span>
              </p>
            </div>
            <a
              href={result.convertedUrl}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 text-sm font-semibold transition-colors shrink-0"
            >
              Mở thử link
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="space-y-2">
            <label htmlFor="converted-tiktok-url" className="block text-sm font-semibold text-gray-800">
              Link www/view/product
            </label>
            <textarea
              id="converted-tiktok-url"
              readOnly
              rows={5}
              value={result.convertedUrl}
              className="w-full resize-y rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 font-mono text-xs leading-5 text-gray-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyUrl(result.convertedUrl, 'converted')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-950 hover:bg-gray-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {copied === 'converted' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'converted' ? 'Đã sao chép' : 'Sao chép link kết quả'}
            </button>
          </div>

          <details className="group rounded-xl border border-gray-200 bg-gray-50">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-700">
              Xem link TikTok Shop chính thức
            </summary>
            <div className="border-t border-gray-200 p-4 space-y-3">
              <textarea
                readOnly
                rows={4}
                value={result.officialUrl}
                aria-label="Link TikTok Shop chính thức"
                className="w-full resize-y rounded-xl border border-gray-200 bg-white p-3 font-mono text-xs leading-5 text-gray-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyUrl(result.officialUrl, 'official')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors cursor-pointer"
              >
                {copied === 'official' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'official' ? 'Đã sao chép' : 'Sao chép link chính thức'}
              </button>
            </div>
          </details>
        </section>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Công cụ giữ nguyên chuỗi query affiliate do TikTok cung cấp và không tự tạo mã affiliate mới.
        Hãy kiểm tra lượt click trong TikTok Affiliate Center trước khi sử dụng cho chiến dịch lớn.
      </div>
    </div>
  )
}
