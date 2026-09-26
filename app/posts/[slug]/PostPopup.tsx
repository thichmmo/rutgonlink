'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Play, X } from 'lucide-react'
import { getPopupStep, type PopupSettings } from '@/lib/popup-settings'

type Popup = {
  imageUrl: string | null
  firstUrl: string
  secondUrl: string
  updatedAt: string
  isActive: boolean
  settings: PopupSettings
}

export default function PostPopup({ postId, popup }: { postId: string; popup: Popup }) {
  const steps = useMemo(() => {
    const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
    const result = [getPopupStep(popup.settings, 0, userAgent), getPopupStep(popup.settings, 1, userAgent)]
    return result.filter((item, index) => {
      const platform = index === 0 ? popup.settings.shopee : popup.settings.tiktok
      const isIos = /iphone|ipad|ipod/i.test(userAgent)
      const isAndroid = /android/i.test(userAgent)
      return platform.enabled && (isIos ? platform.iosEnabled : isAndroid ? platform.androidEnabled : true) && Boolean(item.url)
    })
  }, [popup.settings])
  const storageKey = `post-popup:${postId}:${popup.updatedAt}`
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState('')
  const stepRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored = 0
      try { stored = Number(window.sessionStorage.getItem(storageKey) || 0) } catch { /* Private browsing may disable storage. */ }
      const current = Number.isInteger(stored) && stored >= 0 && stored <= steps.length ? stored : 0
      stepRef.current = current
      setStep(current)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [storageKey, steps.length])

  useEffect(() => {
    if (!ready || step >= steps.length) return
    const delay = Math.max(0, steps[step]?.delaySeconds || 0)
    const startTimer = window.setTimeout(() => setRemaining(delay), 0)
    if (!delay) return () => window.clearTimeout(startTimer)
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => { window.clearTimeout(startTimer); window.clearInterval(timer) }
  }, [ready, step, steps])

  function advance() {
    if (!ready || remaining > 0 || stepRef.current >= steps.length) return
    const current = steps[stepRef.current]
    if (!current?.url) return
    const opened = window.open(current.url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      setError('Trình duyệt đã chặn tab mới. Hãy cho phép popup rồi thử lại.')
      return
    }
    const nextStep = stepRef.current + 1
    stepRef.current = nextStep
    try { window.sessionStorage.setItem(storageKey, String(nextStep)) } catch { /* Continue in memory if storage is unavailable. */ }
    setStep(nextStep)
    setError('')
  }

  if (!popup.isActive || steps.length === 0 || step >= steps.length) return null
  if (!ready) return <div className="fixed inset-0 z-[100] bg-black" aria-label="Đang tải màn hình trung gian" />
  const current = steps[step]
  const forceMessage = current.forceBrowser ? 'Nếu chưa mở, hãy tiếp tục bằng trình duyệt được cấu hình.' : ''

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Màn hình trung gian">
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[#111827] text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">Màn hình trung gian</p><p className="mt-1 text-sm text-white/70">Mở {current.platform} ở lượt {step + 1}/{steps.length} để xem bài viết</p></div>
        <button onClick={advance} disabled={remaining > 0} className="rounded-full border border-white/20 p-2 text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Mở liên kết ${step + 1}`}><X className="h-5 w-5" /></button>
      </div>
      <button onClick={advance} disabled={remaining > 0} className="group relative flex aspect-video w-full items-center justify-center bg-black bg-cover bg-center disabled:cursor-wait" style={current.imageUrl || popup.imageUrl ? { backgroundImage: `url("${(current.imageUrl || popup.imageUrl || '').replaceAll('"', '%22')}")` } : undefined} aria-label={`Mở ${current.platform} trong tab mới`}>
        <span className="absolute inset-0 bg-black/25" />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-red-600 shadow-2xl transition-transform group-hover:scale-110"><Play className="ml-1 h-9 w-9 fill-white" /></span>
        <span className="absolute bottom-0 left-0 right-0 flex items-center gap-3 bg-gradient-to-t from-black/90 to-transparent px-5 pb-5 pt-10 text-left text-xs text-white/80"><Play className="h-4 w-4 fill-white" /><span>0:00 / 4:56</span><span className="ml-auto">● ━━━━</span></span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><p className="text-sm text-white/70">{remaining > 0 ? `Vui lòng chờ ${remaining} giây...` : `Lượt ${step + 1}: mở liên kết ${current.platform}.`}{forceMessage && <span className="mt-1 block text-xs text-amber-300">{forceMessage}</span>}</p><button disabled={remaining > 0} onClick={advance} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-wait disabled:opacity-50"><ExternalLink className="h-4 w-4" /> {remaining > 0 ? `Chờ ${remaining}s` : `Mở ${current.platform}`}</button></div>
      {error && <p role="alert" className="px-5 pb-4 text-sm text-amber-300">{error}</p>}
    </div>
  </div>
}
