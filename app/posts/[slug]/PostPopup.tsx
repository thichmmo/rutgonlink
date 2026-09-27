'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getPopupStep, popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'

type Popup = {
  imageUrl: string | null
  firstUrl: string
  secondUrl: string
  updatedAt: string
  isActive: boolean
  settings: PopupSettings
}

export default function PostPopup({ postId, popup, userAgent }: { postId: string; popup: Popup; userAgent: string }) {
  const steps = useMemo(() => [getPopupStep(popup.settings, 0, userAgent), getPopupStep(popup.settings, 1, userAgent)], [popup.settings, userAgent])
  const storageKey = `post-popup:${postId}:${popup.updatedAt}`
  const cookieKey = `post_popup_${postId}_${popup.updatedAt}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const stepRef = useRef(0)
  const readyAtRef = useRef(0)
  const pendingOpenRef = useRef<{ fromStep: number; nextStep: number; leftPage: boolean } | null>(null)

  const readStoredStep = useCallback(() => {
    const values: number[] = []
    const addValue = (value: string | null | undefined) => {
      const parsed = Number(value || '')
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= steps.length) values.push(parsed)
    }
    try {
      addValue(window.sessionStorage.getItem(storageKey))
    } catch { /* Some in-app browsers disable session storage. */ }
    try {
      addValue(window.localStorage.getItem(storageKey))
    } catch { /* Local storage is only a handoff fallback. */ }
    try {
      const cookie = window.document.cookie.split('; ').find(value => value.startsWith(`${cookieKey}=`))
      addValue(cookie?.slice(cookieKey.length + 1))
    } catch { /* Cookie access can be disabled in private webviews. */ }
    return values.length ? Math.max(...values) : 0
  }, [cookieKey, storageKey, steps.length])

  const commitStep = useCallback((nextStep: number, resetDelay = true) => {
    const boundedStep = Math.max(0, Math.min(steps.length, nextStep))
    stepRef.current = boundedStep
    if (resetDelay) readyAtRef.current = Date.now() + (steps[boundedStep]?.delaySeconds || 0) * 1000
    setStep(boundedStep)
    setRemaining(steps[boundedStep]?.delaySeconds || 0)
    try { window.sessionStorage.setItem(storageKey, String(boundedStep)) } catch { /* Continue in memory if storage is unavailable. */ }
    try {
      if (boundedStep > 0 && boundedStep < steps.length) {
        window.localStorage.setItem(storageKey, String(boundedStep))
        window.document.cookie = `${cookieKey}=${boundedStep}; Path=/; SameSite=Lax`
      } else {
        window.localStorage.removeItem(storageKey)
        window.document.cookie = `${cookieKey}=; Max-Age=0; Path=/; SameSite=Lax`
      }
    } catch { /* Fallback storage is best-effort for restricted webviews. */ }
  }, [cookieKey, steps, storageKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      commitStep(readStoredStep())
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [commitStep, readStoredStep])

  useEffect(() => {
    if (!ready) return

    const syncAfterReturn = () => {
      const pending = pendingOpenRef.current
      if (pending && document.visibilityState === 'hidden') {
        pending.leftPage = true
        return
      }
      if (document.visibilityState !== 'visible') return

      const stored = readStoredStep()
      if (stored !== stepRef.current) commitStep(stored)
      if (pending?.leftPage) {
        pendingOpenRef.current = null
        setOpening(false)
        setError('')
      }
    }

    const markPageHidden = () => {
      if (pendingOpenRef.current) pendingOpenRef.current.leftPage = true
    }
    const markPageVisible = () => syncAfterReturn()
    document.addEventListener('visibilitychange', syncAfterReturn)
    window.addEventListener('pagehide', markPageHidden)
    window.addEventListener('pageshow', markPageVisible)
    return () => {
      document.removeEventListener('visibilitychange', syncAfterReturn)
      window.removeEventListener('pagehide', markPageHidden)
      window.removeEventListener('pageshow', markPageVisible)
    }
  }, [commitStep, readStoredStep, ready])

  useEffect(() => {
    if (!ready || step >= steps.length) return
    const delay = Math.max(0, steps[step]?.delaySeconds || 0)
    const startTimer = window.setTimeout(() => setRemaining(delay), 0)
    if (!delay) return () => window.clearTimeout(startTimer)
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => { window.clearTimeout(startTimer); window.clearInterval(timer) }
  }, [ready, step, steps])

  function advance() {
    if (!ready || opening || Date.now() < readyAtRef.current || stepRef.current >= steps.length) return
    const fromStep = stepRef.current
    const current = steps[fromStep]
    if (!current?.url) {
      setError(`Chưa cấu hình link ${current?.platform || 'popup'}.`)
      return
    }

    const nextStep = fromStep + 1
    const pending = { fromStep, nextStep, leftPage: false }
    pendingOpenRef.current = pending
    setOpening(true)
    // Persist before opening: mobile browsers may navigate this tab instead of
    // returning a WindowProxy, so the next popup must survive the round trip.
    commitStep(nextStep)
    setError('')

    let opened: Window | null = null
    try { opened = window.open(current.url, '_blank') } catch { opened = null }
    if (opened) {
      pendingOpenRef.current = null
      setOpening(false)
      try { opened.opener = null } catch { /* The new tab may have navigated. */ }
      return
    }

    // A blocked popup leaves the page visible; a mobile same-tab handoff fires
    // pagehide/visibilitychange and keeps the persisted next step instead.
    window.setTimeout(() => {
      if (pendingOpenRef.current !== pending || pending.leftPage || document.visibilityState === 'hidden') return
      pendingOpenRef.current = null
      setOpening(false)
      commitStep(fromStep)
      setError('Trình duyệt đã chặn tab mới. Hãy cho phép popup rồi thử lại.')
    }, 900)
  }

  if (!popup.isActive || !popupAppliesToDevice(popup.settings, userAgent) || step >= steps.length) return null
  if (!ready) return <div className="fixed inset-0 z-[100] bg-black" aria-label="Đang tải màn hình trung gian" />

  const current = steps[step]
  const image = current.imageUrl || popup.imageUrl || ''
  const forceMessage = current.forceBrowser ? `Nếu Facebook chặn tab mới, hãy mở trang này bằng ${current.forceBrowser}.` : ''
  const progress = `Bạn cần đóng ${step + 1}/${steps.length} popup để xem được nội dung`
  const buttonLabel = remaining > 0 ? `Chờ ${remaining}s` : opening ? 'Đang mở...' : 'Đóng để xem'

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Màn hình trung gian">
    <div className="w-full max-w-[760px] rounded-[28px] bg-white p-4 text-gray-950 shadow-2xl sm:p-7">
      <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-gray-400">Mở liên kết</p><p className="mt-1 text-sm font-medium text-gray-700">{current.platform} · lượt {step + 1}/{steps.length}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{remaining > 0 ? `Sau ${remaining}s` : 'Sẵn sàng'}</span></div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"><div className="aspect-[1.68] w-full bg-gray-100 bg-contain bg-center bg-no-repeat" style={image ? { backgroundImage: `url("${image.replaceAll('"', '%22')}")` } : undefined} aria-label={`Ảnh ${current.platform}`} /></div>
      <button type="button" onClick={advance} disabled={remaining > 0 || opening} className="mt-5 flex h-16 w-full items-center justify-center rounded-full bg-[#19181d] text-xl font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60 sm:h-[72px] sm:text-2xl">{buttonLabel}</button>
      <p className="mt-4 text-center text-base font-medium text-[#9ba3b3] sm:text-lg">{progress}</p>
      {forceMessage && <p className="mt-2 text-center text-xs text-amber-600">{forceMessage}</p>}
      {error && <button type="button" onClick={advance} className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-[#d61f51] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Thử lại</button>}
    </div>
  </div>
}
