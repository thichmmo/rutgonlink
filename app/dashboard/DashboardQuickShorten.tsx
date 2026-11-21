'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/fetch'
import {
  Link2,
  Copy,
  Check,
  Loader2,
  Send,
  ExternalLink,
  Upload,
  Settings,
} from 'lucide-react'
import { type DashboardQuickMode } from '@/lib/dashboard-quick-mode'
import { type QuickTelegramConfig } from '@/lib/dashboard-quick-mode-server'
import { defaultTelegramSettings, telegramSettingsSchema } from '@/lib/telegram-settings'
import { stripUrlProtocol } from '@/lib/public-post-link'
import { quickMediaHtml } from './posts/telegram-media'
import { normalizeVideoEmbedUrl } from '@/lib/video-embed'

function articleInputUrl(input: string) {
  const value = input.trim()
  if (value.startsWith('<')) return null
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !host.includes('.') ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.startsWith('[')
    ) {
      return null
    }
    return value
  } catch {
    return null
  }
}

function resolvedVideoHtml(input: unknown, kind: unknown) {
  if (typeof input !== 'string' || kind !== 'video') return null
  try {
    const parsed = new URL(input)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.href !== input
    ) {
      return null
    }
    const source = normalizeVideoEmbedUrl(input)
    return source?.kind === 'video' && source.url === input ? quickMediaHtml(input) : null
  } catch {
    return null
  }
}

export default function DashboardQuickShorten({
  mode = 'shorten',
  telegramConfig,
}: {
  mode?: DashboardQuickMode
  telegramConfig?: QuickTelegramConfig
}) {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [refreshedConfig, setRefreshedConfig] = useState<QuickTelegramConfig | undefined>(undefined)
  const tgConfig = refreshedConfig ?? telegramConfig
  const [mediaInput, setMediaInput] = useState('')
  const [createdPost, setCreatedPost] = useState<{ title: string; publicUrl: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  const refreshQuickConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/quick-mode', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.telegramConfig) setRefreshedConfig(data.telegramConfig)
    } catch {
      // Silent refresh best-effort on tab focus.
    }
  }, [])

  useEffect(() => {
    if (mode !== 'telegram-post') return
    window.addEventListener('focus', refreshQuickConfig)
    return () => window.removeEventListener('focus', refreshQuickConfig)
  }, [mode, refreshQuickConfig])

  const flashCopy = async (textToCopy: string) => {
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const handleShortenSubmit = async (e: React.FormEvent) => {
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

  const publishTelegramHtml = async (contentHtml: string) => {
    const cfg = tgConfig ?? {
      latestPopup: null,
      domainId: null,
      sharedDomain: 'ca33newss.xyz',
      domainName: 'ca33newss.xyz',
      telegramDefaults: defaultTelegramSettings(),
    }

    const tgPayload = { ...cfg.telegramDefaults, enabled: true }
    const validatedTg = telegramSettingsSchema.safeParse(tgPayload)
    if (!validatedTg.success) {
      setError(
        validatedTg.error.issues[0]?.message ||
          'Chưa lưu link nhóm Telegram mặc định. Hãy vào Cài đặt -> Mặc định Telegram để lưu link nhóm trước.',
      )
      return false
    }

    const res = await apiFetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Video Telegram',
        publicLinkMode: 'numeric',
        content: contentHtml,
        contentFormat: 'rich',
        isPublished: true,
        popupIds: cfg.latestPopup ? [cfg.latestPopup.id] : [],
        telegramSettings: validatedTg.data,
        domainId: cfg.domainId,
        sharedDomain: cfg.sharedDomain,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data?.items?.[0]) {
      setError(data?.error || 'Không thể tạo bài viết Telegram')
      return false
    }

    const item = data.items[0]
    setCreatedPost({ title: item.title, publicUrl: item.publicUrl })
    setMediaInput('')
    window.dispatchEvent(new window.Event('popup-stats-refresh'))
    return true
  }

  const handleTelegramSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mediaInput.trim() || loading) return

    setLoading(true)
    setError('')
    setCreatedPost(null)

    try {
      let html = quickMediaHtml(mediaInput)
      if (!html) {
        const articleUrl = articleInputUrl(mediaInput)
        if (articleUrl) {
          const resolveRes = await fetch('/api/content/resolve-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: articleUrl }),
          })
          const resolveData = await resolveRes.json()
          if (!resolveRes.ok) {
            setError(resolveData?.error || 'Không tìm được video từ bài viết. Hãy thử lại.')
            return
          }
          html = resolvedVideoHtml(resolveData?.url, resolveData?.kind)
        }
      }

      if (!html) {
        setError(
          'Dán URL video công khai, mã iframe (YouTube, TikTok, Facebook, Vimeo, Google Drive...) hoặc link MP4/WebM/OGG.',
        )
        return
      }

      await publishTelegramHtml(html)
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleTelegramUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || loading) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Vui lòng chọn tệp ảnh hoặc video.')
      return
    }

    setLoading(true)
    setError('')
    setCreatedPost(null)

    try {
      const body = new FormData()
      body.append('file', file)
      const uploadRes = await fetch('/api/content/upload', { method: 'POST', body })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        setError(uploadData?.error || 'Không thể tải tệp lên')
        return
      }
      const html = quickMediaHtml(String(uploadData.url), file.type)
      if (!html) {
        setError('URL video/ảnh tải lên không hợp lệ')
        return
      }
      await publishTelegramHtml(html)
    } catch {
      setError('Không thể tải tệp lên')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'telegram-post') {
    const popupLabel = tgConfig?.latestPopup?.name || 'Không có'
    const domainLabel = tgConfig?.domainName || 'ca33newss.xyz'
    const cleanPostLink = createdPost ? stripUrlProtocol(createdPost.publicUrl) : ''

    return (
      <div
        data-quick-mode="telegram-post"
        className="bg-gradient-to-r from-sky-600 to-sky-800 rounded-2xl p-4 sm:p-6 text-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="font-semibold flex items-center gap-2">
            <Send className="w-5 h-5" />
            Tạo nhanh bài Telegram
          </h2>
          <Link
            href="/dashboard/settings#quick-create-mode"
            className="inline-flex items-center gap-1 text-xs text-sky-100 hover:text-white underline underline-offset-2"
          >
            <Settings className="w-3.5 h-3.5" />
            Đổi chế độ
          </Link>
        </div>
        <p className="text-sky-200 text-sm mb-4">
          Tạo nhanh bằng URL video hoặc mã iframe · Popup gần nhất:{' '}
          <strong className="text-white">{popupLabel}</strong> · Domain:{' '}
          <strong className="text-white">{domainLabel}</strong> · Xuất bản ngay
        </p>

        {!tgConfig?.telegramDefaults?.url && (
          <div className="mb-3 rounded-xl bg-amber-500/25 border border-amber-300/40 px-3.5 py-2 text-xs text-amber-50">
            Chưa lưu link nhóm Telegram mặc định. Hãy vào{' '}
            <Link href="/dashboard/settings" className="font-semibold underline">
              Cài đặt → Mặc định Telegram
            </Link>{' '}
            để lưu link nhóm trước khi xuất bản nhanh.
          </div>
        )}

        <form onSubmit={handleTelegramSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            value={mediaInput}
            onChange={(e) => {
              setMediaInput(e.target.value)
              setError('')
            }}
            type="text"
            aria-label="Tạo nhanh bằng URL video hoặc mã iframe"
            placeholder="Dán URL video, mã iframe hoặc link bài viết có video..."
            className="flex-1 min-w-0 px-4 py-2.5 bg-white/20 border border-white/30 rounded-xl text-white placeholder-sky-200 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          <div className="flex gap-2 shrink-0">
            <button
              type="submit"
              disabled={loading || !mediaInput.trim()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-white text-sky-700 font-semibold text-sm rounded-xl hover:bg-sky-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Xuất bản ngay
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
              title="Upload video hoặc ảnh"
              className="px-3.5 py-2.5 bg-white/15 border border-white/30 text-white font-semibold text-sm rounded-xl hover:bg-white/25 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden md:inline">Upload</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              disabled={loading}
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/ogg"
              onChange={(e) => void handleTelegramUpload(e)}
              className="hidden"
            />
          </div>
        </form>

        {error && <p role="alert" className="mt-2 text-red-200 text-sm">{error}</p>}

        {createdPost && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-white/20 rounded-xl px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-sky-100 mr-2">Mã bài #{createdPost.title}:</span>
              <span className="text-sm font-semibold break-all">{cleanPostLink}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void flashCopy(cleanPostLink)}
                className="flex items-center justify-center gap-1 text-xs bg-white text-sky-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-50 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép' : 'Copy link'}
              </button>
              <a
                href={createdPost.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-xs bg-white/15 border border-white/30 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-white/25 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở bài
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-quick-mode="shorten"
      className="bg-gradient-to-r from-sky-600 to-sky-800 rounded-2xl p-4 sm:p-6 text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Rút gọn link nhanh
        </h2>
        <Link
          href="/dashboard/settings#quick-create-mode"
          className="inline-flex items-center gap-1 text-xs text-sky-100 hover:text-white underline underline-offset-2"
        >
          <Settings className="w-3.5 h-3.5" />
          Đổi chế độ
        </Link>
      </div>
      <p className="text-sky-200 text-sm mb-4">Tạo link ngắn ngay tại đây</p>
      <form onSubmit={handleShortenSubmit} className="flex flex-col sm:flex-row gap-3">
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
            type="button"
            onClick={() => void flashCopy(shortUrl)}
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
