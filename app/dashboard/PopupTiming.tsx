'use client'

import { useEffect, useState } from 'react'
import { Clock3, RotateCcw } from 'lucide-react'
import { popupTiming, type PopupTimingSettings } from './popup-timing'

export function PopupTimingSummary({ settings }: { settings?: PopupTimingSettings | null }) {
  const timing = popupTiming(settings)
  return <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium" aria-label="Thời gian popup">
    <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">Shopee {timing.shopeeSeconds}s</span>
    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">TikTok {timing.tiktokSeconds}s</span>
    <span className="rounded-full bg-pink-50 px-2 py-1 text-[#d61f51]">Cooldown {timing.cooldownMinutes} phút</span>
  </div>
}

function CountdownDemo({ delays }: { delays: number[] }) {
  const [step, setStep] = useState(0)
  const [remaining, setRemaining] = useState(delays[0])
  const [deadline, setDeadline] = useState(() => Date.now() + delays[0] * 1000)
  const done = step === delays.length
  const platform = step === 0 ? 'Shopee' : 'TikTok'

  useEffect(() => {
    if (done) return
    // Use elapsed wall time, not interval ticks, to match a backgrounded mobile tab.
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    const timer = window.setInterval(update, 250)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [deadline, done])

  function goTo(next: number) {
    setStep(next)
    setRemaining(delays[next] || 0)
    setDeadline(Date.now() + (delays[next] || 0) * 1000)
  }

  return <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3" data-testid="countdown-preview">
    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700">
      <span>{done ? 'Nội dung bài viết đã mở' : `${platform} · lượt ${step + 1}/2`}</span>
      <span role="timer" aria-live="off" className="tabular-nums">{remaining}s</span>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><div className="h-full bg-[#d61f51]" style={{ width: `${done || !delays[step] ? 100 : Math.min(100, Math.max(0, (1 - remaining / delays[step]) * 100))}%` }} /></div>
    {!done && <button type="button" disabled={remaining > 0} onClick={() => { if (Date.now() >= deadline) goTo(step + 1) }} className="mt-3 w-full rounded-full bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">{remaining > 0 ? `Chờ ${remaining}s` : `Mô phỏng mở ${platform}`}</button>}
    <button type="button" onClick={() => goTo(0)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gray-600"><RotateCcw className="h-3.5 w-3.5" /> Chạy lại</button>
    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">Bản xem thử chạy hai lượt theo cấu hình; không mở app và không ghi lượt click.</p>
  </div>
}

export function PopupTimingPreview({ settings, name }: { settings?: PopupTimingSettings | null; name?: string }) {
  const [expanded, setExpanded] = useState(false)
  const timing = popupTiming(settings)
  return <section className="rounded-xl border border-gray-200 bg-slate-50 p-3" aria-label={name ? `Bộ đếm ${name}` : 'Bộ đếm thời gian'}>
    <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800"><Clock3 className="h-4 w-4" /> {name || 'Bộ đếm thời gian'}</div>
    <PopupTimingSummary settings={settings} />
    <p className="mt-2 text-xs leading-relaxed text-gray-600">Nút mở link chỉ bật khi hết số giây của lượt đó. 0 giây cho phép bấm ngay. Cooldown tính từ khi hoàn tất hai lượt; 0 phút cho phép hiện lại ở lần tải trang kế tiếp.</p>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-2 text-xs font-semibold text-[#d61f51]">{expanded ? 'Ẩn xem thử' : 'Xem thử bộ đếm'}</button>
    {expanded && <CountdownDemo key={`${timing.shopeeSeconds}:${timing.tiktokSeconds}`} delays={[timing.shopeeSeconds, timing.tiktokSeconds]} />}
  </section>
}
