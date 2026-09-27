'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState('')
  const stepRef = useRef(0)
  const readyAtRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored = 0
      try { stored = Number(window.sessionStorage.getItem(storageKey) || 0) } catch { /* Private browsing may disable storage. */ }
      const current = Number.isInteger(stored) && stored >= 0 && stored <= steps.length ? stored : 0
      stepRef.current = current
      readyAtRef.current = Date.now() + (steps[current]?.delaySeconds || 0) * 1000
      setStep(current)
      setRemaining(steps[current]?.delaySeconds || 0)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [storageKey, steps])

  useEffect(() => {
    if (!ready || step >= steps.length) return
    const delay = Math.max(0, steps[step]?.delaySeconds || 0)
    const startTimer = window.setTimeout(() => setRemaining(delay), 0)
    if (!delay) return () => window.clearTimeout(startTimer)
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => { window.clearTimeout(startTimer); window.clearInterval(timer) }
  }, [ready, step, steps])

  function advance() {
    if (!ready || Date.now() < readyAtRef.current || stepRef.current >= steps.length) return
    const current = steps[stepRef.current]
    if (!current?.url) {
      setError(`Chưa cấu hình link ${current?.platform || 'popup'}.`)
      return
    }

    // Only count a step when the browser actually returns a new tab. This keeps
    // Facebook/in-app browsers retryable when their popup blocker intervenes.
    const opened = window.open(current.url, '_blank')
    if (!opened) {
      setError('Trình duyệt đã chặn tab mới. Hãy cho phép popup rồi thử lại.')
      return
    }
    try { opened.opener = null } catch { /* The new tab may have navigated. */ }

    const nextStep = stepRef.current + 1
    stepRef.current = nextStep
    readyAtRef.current = Date.now() + (steps[nextStep]?.delaySeconds || 0) * 1000
    setRemaining(steps[nextStep]?.delaySeconds || 0)
    try { window.sessionStorage.setItem(storageKey, String(nextStep)) } catch { /* Continue in memory if storage is unavailable. */ }
    setStep(nextStep)
    setError('')
  }

  if (!popup.isActive || !popupAppliesToDevice(popup.settings, userAgent) || step >= steps.length) return null
  if (!ready) return <div className="fixed inset-0 z-[100] bg-black" aria-label="Đang tải màn hình trung gian" />

  const current = steps[step]
  const image = current.imageUrl || popup.imageUrl || ''
  const forceMessage = current.forceBrowser ? `Nếu Facebook chặn tab mới, hãy mở trang này bằng ${current.forceBrowser}.` : ''
  const progress = `Bạn cần đóng ${step + 1}/${steps.length} popup để xem được nội dung`
  const buttonLabel = remaining > 0 ? `Chờ ${remaining}s` : 'Đóng để xem'

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Màn hình trung gian">
    <div className="w-full max-w-[760px] rounded-[28px] bg-white p-4 text-gray-950 shadow-2xl sm:p-7">
      <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-gray-400">Mở liên kết</p><p className="mt-1 text-sm font-medium text-gray-700">{current.platform} · lượt {step + 1}/{steps.length}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{remaining > 0 ? `Sau ${remaining}s` : 'Sẵn sàng'}</span></div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"><div className="aspect-[1.68] w-full bg-gray-100 bg-contain bg-center bg-no-repeat" style={image ? { backgroundImage: `url("${image.replaceAll('"', '%22')}")` } : undefined} aria-label={`Ảnh ${current.platform}`} /></div>
      <button type="button" onClick={advance} disabled={remaining > 0} className="mt-5 flex h-16 w-full items-center justify-center rounded-full bg-[#19181d] text-xl font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60 sm:h-[72px] sm:text-2xl">{buttonLabel}</button>
      <p className="mt-4 text-center text-base font-medium text-[#9ba3b3] sm:text-lg">{progress}</p>
      {forceMessage && <p className="mt-2 text-center text-xs text-amber-600">{forceMessage}</p>}
      {error && <button type="button" onClick={advance} className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-[#d61f51] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Thử lại</button>}
    </div>
  </div>
}
