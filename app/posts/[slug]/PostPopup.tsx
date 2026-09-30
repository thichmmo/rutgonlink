'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { getPopupStep, isMobileUserAgent, popupAppliesToDevice, type PopupSettings } from '@/lib/popup-settings'

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
  const isMobile = isMobileUserAgent(userAgent)
  const applies = popup.isActive && popupAppliesToDevice(popup.settings, userAgent)
  const storageKey = `post-popup:${postId}:${popup.updatedAt}`
  const cookieKey = `post_popup_${postId}_${new Date(popup.updatedAt).getTime()}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  // An unfinished app round trip needs resume time even when repeat cooldown is zero.
  const handoffTtlMs = 30 * 60 * 1000
  const cooldownMs = Math.max(0, Number(popup.settings.cooldownMinutes || 0)) * 60 * 1000
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
    const addValue = (raw: string | null | undefined, source: 'session' | 'local' | 'cookie') => {
      if (!raw) return
      const parts = raw.split('|')
      const value = Number(parts[0])
      if (!Number.isInteger(value) || value < 1 || value > steps.length) return
      // Migrate an old in-flight Shopee return, but not the old permanent completion.
      if (source === 'session' && parts.length === 1 && value === 1) {
        try { window.sessionStorage.setItem(storageKey, `1|${Date.now() + handoffTtlMs}`) } catch { /* Resume in memory. */ }
        values.push(value)
        return
      }
      const expiry = Number(parts[1])
      if (!Number.isFinite(expiry) || expiry <= Date.now()) return
      // Completion carries the configured duration; ignore legacy fixed-30m markers.
      if (value === steps.length && (cooldownMs === 0 || Number(parts[2]) !== cooldownMs)) return
      values.push(value)
    }
    try {
      addValue(window.sessionStorage.getItem(storageKey), 'session')
    } catch { /* Some in-app browsers disable session storage. */ }
    try {
      addValue(window.localStorage.getItem(storageKey), 'local')
    } catch { /* Local storage is only a handoff fallback. */ }
    try {
      const cookie = window.document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieKey}=`))
      addValue(cookie?.slice(cookieKey.length + 1), 'cookie')
    } catch { /* Cookie access can be disabled in private webviews. */ }
    return values.length ? Math.max(...values) : 0
  }, [cookieKey, cooldownMs, handoffTtlMs, storageKey, steps.length])

  const commitStep = useCallback((nextStep: number, persist = true) => {
    const boundedStep = Math.max(0, Math.min(steps.length, nextStep))
    stepRef.current = boundedStep
    readyAtRef.current = Date.now() + (steps[boundedStep]?.delaySeconds || 0) * 1000
    setStep(boundedStep)
    setRemaining(steps[boundedStep]?.delaySeconds || 0)
    // Reading saved progress must not restart its expiry on every reload/focus.
    if (!persist) return
    const ttlMs = boundedStep === steps.length ? cooldownMs : handoffTtlMs
    const saved = boundedStep > 0 && ttlMs > 0
      ? `${boundedStep}|${Date.now() + ttlMs}${boundedStep === steps.length ? `|${cooldownMs}` : ''}`
      : ''
    // Zero cooldown clears completion for the next visit, not this document's progress.
    try {
      if (saved) window.sessionStorage.setItem(storageKey, saved)
      else window.sessionStorage.removeItem(storageKey)
    } catch { /* Continue in memory if storage is unavailable. */ }
    // A failed local-storage write must not prevent the cookie fallback from running.
    try {
      if (saved) window.localStorage.setItem(storageKey, saved)
      else window.localStorage.removeItem(storageKey)
    } catch { /* Fallback storage is best-effort for restricted webviews. */ }
    try {
      window.document.cookie = `${cookieKey}=${saved}; Max-Age=${saved ? ttlMs / 1000 : 0}; Path=/; SameSite=Lax`
    } catch { /* Retain in-memory progress even when both fallbacks are disabled. */ }
  }, [cooldownMs, cookieKey, handoffTtlMs, steps, storageKey])

  useEffect(() => {
    // Desktop/inactive views must not read or migrate mobile handoff storage.
    if (!applies) return
    const timer = window.setTimeout(() => {
      commitStep(readStoredStep(), false)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [applies, commitStep, readStoredStep])

  useEffect(() => {
    if (!applies || !ready) return

    const syncAfterReturn = () => {
      const pending = pendingOpenRef.current
      if (pending && document.visibilityState === 'hidden') {
        pending.leftPage = true
        return
      }
      if (document.visibilityState !== 'visible') return

      const stored = readStoredStep()
      // Missing/expired storage must never rewind progress already committed in this document.
      if (stored > stepRef.current) commitStep(stored, false)
      if (pending?.leftPage) {
        pendingOpenRef.current = null
        setOpening(false)
        setError('')
      }
      setRemaining(Math.max(0, Math.ceil((readyAtRef.current - Date.now()) / 1000)))
    }

    const markPageHidden = () => {
      if (pendingOpenRef.current) pendingOpenRef.current.leftPage = true
    }
    const markPageVisible = () => syncAfterReturn()
    document.addEventListener('visibilitychange', syncAfterReturn)
    window.addEventListener('pagehide', markPageHidden)
    window.addEventListener('pageshow', markPageVisible)
    // Some mobile webviews keep visibilityState=visible while a new tab is foregrounded.
    window.addEventListener('blur', markPageHidden)
    window.addEventListener('focus', markPageVisible)
    return () => {
      document.removeEventListener('visibilitychange', syncAfterReturn)
      window.removeEventListener('pagehide', markPageHidden)
      window.removeEventListener('pageshow', markPageVisible)
      window.removeEventListener('blur', markPageHidden)
      window.removeEventListener('focus', markPageVisible)
    }
  }, [applies, commitStep, readStoredStep, ready])

  useEffect(() => {
    if (!applies || !ready || step >= steps.length) return
    // Timers pause in backgrounded iOS webviews; derive the countdown from its deadline.
    const update = () => setRemaining(Math.max(0, Math.ceil((readyAtRef.current - Date.now()) / 1000)))
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [applies, ready, step, steps])

  function advance() {
    if (!applies || !ready || pendingOpenRef.current || step !== stepRef.current || Date.now() < readyAtRef.current || stepRef.current >= steps.length) return
    const fromStep = stepRef.current
    const current = steps[fromStep]
    if (!current?.url) {
      setError(`Chưa cấu hình link ${current?.platform || 'popup'}.`)
      return
    }

    const nextStep = fromStep + 1
    const pending = { fromStep, nextStep, leftPage: false }
    pendingOpenRef.current = pending
    // Commit the DOM before iOS snapshots/suspends this page, without losing the click gesture.
    flushSync(() => {
      setOpening(true)
      commitStep(nextStep)
      setError('')
    })

    if (current.openMode === 'same-tab') {
      // Use the OneLink handoff in the originating Facebook tab, as in the reference flow.
      try {
        window.location.replace(current.url)
      } catch {
        pendingOpenRef.current = null
        setOpening(false)
        commitStep(fromStep)
        setError('Không thể mở liên kết, hãy thử lại.')
      }
      return
    }

    let opened: Window | null = null
    try {
      if (current.openMode === 'anchor-new-tab') {
        // An attached link gives Facebook/iOS a navigation action, not a script-created blank child.
        const anchor = document.createElement('a')
        anchor.href = current.url
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.hidden = true
        document.body.appendChild(anchor)
        try { anchor.click() } finally { anchor.remove() }
      } else {
        opened = window.open(current.url, '_blank')
      }
    } catch {
      pendingOpenRef.current = null
      setOpening(false)
      commitStep(fromStep)
      setError('Không thể mở liên kết, hãy thử lại.')
      return
    }
    if (opened) {
      pendingOpenRef.current = null
      setOpening(false)
      try { opened.opener = null } catch { /* The new tab may have navigated. */ }
      return
    }

    // Anchors have no window handle. Retain the same pending guard until the app
    // round trip or timeout, so a second tap cannot launch TikTok immediately.
    window.setTimeout(() => {
      if (pendingOpenRef.current !== pending || pending.leftPage || document.visibilityState === 'hidden') return
      pendingOpenRef.current = null
      setOpening(false)
      // Mobile browsers can return null even after successfully opening a tab.
      // Keep the committed step instead of replaying Shopee on return.
      if (isMobile) return
      commitStep(fromStep)
      setError('Trình duyệt đã chặn tab mới. Hãy cho phép popup rồi thử lại.')
    }, 900)
  }

  if (!applies || step >= steps.length) return null
  if (!ready) return <div className="fixed inset-0 z-[100] bg-black" aria-label="Đang tải màn hình trung gian" />

  const current = steps[step]
  const image = current.imageUrl || popup.imageUrl || ''
  const forceMessage = current.forceBrowser ? `Nếu Facebook chặn tab mới, hãy mở trang này bằng ${current.forceBrowser}.` : ''
  const progress = `Bạn cần đóng ${step + 1}/${steps.length} popup để xem được nội dung`
  const buttonLabel = remaining > 0 ? `Chờ ${remaining}s` : opening ? 'Đang mở...' : 'Đóng để xem'
  const delay = Math.max(0, Number(current.delaySeconds || 0))
  const timerPercent = delay ? Math.min(100, Math.max(0, ((delay - remaining) / delay) * 100)) : 100

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Màn hình trung gian">
    <div className="w-full max-w-[760px] rounded-[28px] bg-white p-4 text-gray-950 shadow-2xl sm:p-7">
      <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-gray-400">Mở liên kết</p><p className="mt-1 text-sm font-medium text-gray-700">{current.platform} · lượt {step + 1}/{steps.length}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{remaining > 0 ? `Sau ${remaining}s` : 'Sẵn sàng'}</span></div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"><div className="aspect-[1.68] w-full bg-gray-100 bg-contain bg-center bg-no-repeat" style={image ? { backgroundImage: `url("${image.replaceAll('"', '%22')}")` } : undefined} aria-label={`Ảnh ${current.platform}`} /></div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500"><span role="timer" aria-live="off" aria-label={`Thời gian chờ ${current.platform}`}>{remaining > 0 ? `Còn ${remaining} giây` : 'Sẵn sàng'}</span><span>{delay}s</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={`Bộ đếm ${current.platform}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timerPercent)} aria-valuetext={remaining > 0 ? `Còn ${remaining} giây` : 'Sẵn sàng'}><div className="h-full rounded-full bg-[#d61f51] transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${timerPercent}%` }} /></div>
      </div>
      <button type="button" onClick={advance} disabled={remaining > 0 || opening} className="mt-5 flex h-16 w-full items-center justify-center rounded-full bg-[#19181d] text-xl font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60 sm:h-[72px] sm:text-2xl">{buttonLabel}</button>
      <p className="mt-4 text-center text-base font-medium text-[#9ba3b3] sm:text-lg">{progress}</p>
      {forceMessage && <p className="mt-2 text-center text-xs text-amber-600">{forceMessage}</p>}
      {error && <button type="button" onClick={advance} className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-[#d61f51] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Thử lại</button>}
    </div>
  </div>
}
