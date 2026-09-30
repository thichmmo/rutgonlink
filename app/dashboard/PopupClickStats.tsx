'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ClickGroup, PlatformClicks, PopupCountsResponse } from '@/lib/popup-analytics'

export function useLivePopupStats<T>(url: string) {
  const [result, setResult] = useState<{ url: string; data: T }>()
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let alive = true, pending = false
    const controller = new AbortController()
    async function load() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Chưa tải được thống kê click. Đang thử lại...')
        const data: T = await response.json()
        if (alive) { setResult({ url, data }); setError('') }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Lỗi tải thống kê')
      } finally { pending = false }
    }
    // No overlapping polls; an old filter/page response cannot overwrite the new selection.
    const first = window.setTimeout(load, 150)
    const timer = window.setInterval(load, 5000)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; controller.abort(); window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener('visibilitychange', load) }
  }, [url, revision])
  return { data: result?.url === url ? result.data : undefined, error, refresh }
}

export function usePopupCounts(group: ClickGroup, ids: string[]) {
  const key = [...ids].sort().join(',')
  return useLivePopupStats<PopupCountsResponse>(`/api/popup-stats?group=${group}&ids=${encodeURIComponent(key)}`)
}

export function PopupClickBadge({ clicks }: { clicks?: PlatformClicks }) {
  return <span className="inline-flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Click popup hôm nay">
    <strong className="text-emerald-700">Today: {clicks?.total ?? '...'}</strong>
    <span className="text-orange-600">Shopee: {clicks?.shopee ?? '...'}</span>
    <span className="text-slate-600">TikTok: {clicks?.tiktok ?? '...'}</span>
  </span>
}

export function PopupClickSummary({ clicks, error }: { clicks?: PlatformClicks; error: string }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
    <span className="text-xs font-semibold text-gray-700">Tổng click popup hôm nay</span><PopupClickBadge clicks={clicks} />
    <Link href="/dashboard#popup-click-analytics" className="ml-auto text-xs font-semibold text-sky-700 hover:underline">Xem thống kê chi tiết</Link>
    {error && <p role="status" className="w-full text-xs text-amber-700">{error} Số liệu đang hiển thị có thể chưa cập nhật.</p>}
  </div>
}
