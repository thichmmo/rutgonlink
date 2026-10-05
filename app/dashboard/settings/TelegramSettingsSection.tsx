'use client'

import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { defaultTelegramSettings, normalizeTelegramSettings, type TelegramSettings } from '@/lib/telegram-settings'
import TelegramSettingsFields from './TelegramSettingsFields'

type Props = { onSaved?: (settings: TelegramSettings) => void }

export default function TelegramSettingsSection({ onSaved }: Props) {
  const [value, setValue] = useState<TelegramSettings>(defaultTelegramSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/settings/telegram', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Không tải được cài đặt Telegram')
        if (!controller.signal.aborted) setValue(normalizeTelegramSettings(data))
      })
      .catch(cause => {
        if (controller.signal.aborted) return
        setMessage(cause instanceof Error ? cause.message : 'Không tải được cài đặt Telegram')
        setFailed(true)
        setLoadFailed(true)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  async function save() {
    if (loading || saving || loadFailed) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/settings/telegram', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không lưu được cài đặt Telegram')
      const saved = normalizeTelegramSettings(data)
      setValue(saved)
      onSaved?.(saved)
      setFailed(false)
      setMessage('Đã lưu mẫu link và nội dung cho bài Telegram mới. Bài thường và các bài đã tạo giữ nguyên.')
    } catch (cause) {
      setFailed(true)
      setMessage(cause instanceof Error ? cause.message : 'Không lưu được cài đặt Telegram')
    } finally { setSaving(false) }
  }

  return <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Mặc định Telegram của tài khoản">
    <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Send className="h-5 w-5 text-[#229ED9]" /> Mặc định Telegram</h2>
    <p className="mb-5 mt-2 text-sm text-gray-600">Lưu link, chữ trên nút và đoạn thông báo một lần để tạo bài Telegram nhanh. Chọn Tạo bài thường nếu không cần Telegram. Thay đổi mẫu không sửa bài cũ hoặc bài đang soạn.</p>
    {loading ? <p role="status" className="py-5 text-sm text-gray-500">Đang tải cài đặt Telegram...</p> : <TelegramSettingsFields value={value} onChange={setValue} disabled={saving || loadFailed} accountDefaults />}
    {message && <p role={failed ? 'alert' : 'status'} className={`mt-4 rounded-lg p-3 text-sm ${failed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      {loadFailed && <button type="button" onClick={() => { setLoading(true); setLoadFailed(false); setMessage(''); setAttempt(current => current + 1) }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Tải lại</button>}
      <button type="button" disabled={loading || saving || loadFailed} onClick={() => void save()} className="rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu mặc định Telegram'}</button>
    </div>
  </section>
}
