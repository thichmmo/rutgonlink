'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Play, X } from 'lucide-react'

type Popup = { imageUrl: string | null; firstUrl: string; secondUrl: string; updatedAt: string }

export default function PostPopup({ postId, popup }: { postId: string; popup: Popup }) {
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const stepRef = useRef(0)
  const storageKey = `post-popup:${postId}:${popup.updatedAt}`

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored = 0
      try { stored = Number(window.sessionStorage.getItem(storageKey) || 0) } catch { /* Private browsing may disable storage. */ }
      const current = stored === 1 || stored === 2 ? stored : 0
      stepRef.current = current
      setStep(current)
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [storageKey])

  function advance() {
    if (stepRef.current >= 2) return
    const destination = stepRef.current === 0 ? popup.firstUrl : popup.secondUrl
    // Open inside the user gesture; a blocked tab must not count as a completed step.
    const opened = window.open(destination, '_blank')
    if (!opened) {
      setError('Trình duyệt đã chặn tab mới. Hãy cho phép popup rồi thử lại.')
      return
    }
    try { opened.opener = null } catch { /* The new tab may already have navigated. */ }
    const nextStep = stepRef.current + 1
    stepRef.current = nextStep
    try { window.sessionStorage.setItem(storageKey, String(nextStep)) } catch { /* Continue in memory if storage is unavailable. */ }
    setStep(nextStep)
    setError('')
  }

  if (step >= 2) return null
  if (!ready) return <div className="fixed inset-0 z-[100] bg-black" aria-label="Đang tải màn hình trung gian" />

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Màn hình trung gian">
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[#111827] text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">Màn hình trung gian</p><p className="mt-1 text-sm text-white/70">Mở liên kết {step + 1}/2 để xem bài viết</p></div>
        <button onClick={advance} className="rounded-full border border-white/20 p-2 text-white/80 hover:bg-white/10" aria-label={`Đóng màn hình trung gian, mở liên kết ${step + 1}`}><X className="h-5 w-5" /></button>
      </div>
      <button onClick={advance} className="group relative flex aspect-video w-full items-center justify-center bg-black bg-cover bg-center" style={popup.imageUrl ? { backgroundImage: `url("${popup.imageUrl.replaceAll('"', '%22')}")` } : undefined} aria-label={`Mở liên kết ${step + 1} trong tab mới`}>
        <span className="absolute inset-0 bg-black/25" />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-red-600 shadow-2xl transition-transform group-hover:scale-110"><Play className="ml-1 h-9 w-9 fill-white" /></span>
        <span className="absolute bottom-0 left-0 right-0 flex items-center gap-3 bg-gradient-to-t from-black/90 to-transparent px-5 pb-5 pt-10 text-left text-xs text-white/80"><Play className="h-4 w-4 fill-white" /><span>0:00 / 4:56</span><span className="ml-auto">● ━━━━</span></span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><p className="text-sm text-white/70">{step === 0 ? 'Lượt 1: mở liên kết đầu tiên.' : 'Lượt 2: mở liên kết tiếp theo, sau đó bài viết sẽ hiện ra.'}</p><button onClick={advance} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"><ExternalLink className="h-4 w-4" /> Mở liên kết {step + 1}</button></div>
      {error && <p role="alert" className="px-5 pb-4 text-sm text-amber-300">{error}</p>}
    </div>
  </div>
}
