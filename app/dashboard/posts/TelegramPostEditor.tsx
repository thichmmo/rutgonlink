'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Send, Trash2, Upload } from 'lucide-react'
import type { TelegramSettings } from '@/lib/telegram-settings'
import TelegramSettingsFields from '../settings/TelegramSettingsFields'
import { quickMediaHtml, removeTelegramMedia, telegramMediaItems } from './telegram-media'

type Props = {
  value: TelegramSettings
  onChange: (value: TelegramSettings) => void
  content: string
  onInsert: (html: string, replace: boolean, fileName?: string) => void
  onContentChange?: (nextHtml: string) => void
  onUpload: (file: File) => Promise<string>
  onUploadingChange: (uploading: boolean) => void
  disabled: boolean
  fixedMode?: boolean
  showSettings?: boolean
}

export default function TelegramPostEditor({ value, onChange, content, onInsert, onContentChange, onUpload, onUploadingChange, disabled, fixedMode = false, showSettings = false }: Props) {
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [replace, setReplace] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(!value.url)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const media = telegramMediaItems(content)
  const previews = media.map(item => item.preview).filter(item => item !== null)

  useEffect(() => () => { requestRef.current += 1 }, [])

  function confirmedReplace() {
    return !replace || !content.trim() || window.confirm('Thay toàn bộ nội dung hiện tại bằng video/ảnh mới? Tiêu đề và cài đặt Telegram được giữ nguyên.')
  }

  function insertUrl() {
    if (disabled || uploading) return
    const html = quickMediaHtml(input)
    if (!html) {
      setError('Dán URL video công khai hoặc iframe YouTube, Vimeo, TikTok, Facebook, Instagram, Google Drive; hoặc link MP4/WebM/OGG.')
      return
    }
    if (!confirmedReplace()) return
    onInsert(html, replace)
    setInput('')
    setError('')
    setMessage('Đã chèn video. Lưu bài để hoàn tất.')
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    if (disabled || uploading) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !confirmedReplace()) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { setError('Vui lòng chọn ảnh hoặc video.'); return }
    const request = ++requestRef.current
    setUploading(true)
    onUploadingChange(true)
    setError('')
    setMessage('')
    try {
      const url = await onUpload(file)
      // A response from a closed editor must not insert into the next post.
      if (request !== requestRef.current) return
      const html = quickMediaHtml(url, file.type)
      if (!html) throw new Error('URL video/ảnh tải lên không hợp lệ')
      onInsert(html, replace, file.name)
      setMessage('Đã tải và chèn video/ảnh. Tiêu đề có sẵn được giữ nguyên.')
    } catch (cause) {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : 'Không tải được tệp')
    } finally {
      if (request === requestRef.current) { setUploading(false); onUploadingChange(false) }
    }
  }

  function deleteMedia(index: number) {
    if (disabled || uploading || !onContentChange) return
    onContentChange(removeTelegramMedia(content, index))
    setError('')
    setMessage(`Đã xóa ${media[index]?.kind === 'image' ? 'ảnh' : 'video'} ${index + 1}. Nội dung còn lại được giữ nguyên.`)
  }

  return <section className="my-4 space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5" aria-label="Bài viết Telegram">
    <div><h3 className="flex items-center gap-2 font-semibold text-gray-950"><Send className="h-5 w-5 text-[#229ED9]" /> Bài viết Telegram</h3><p className="mt-1 text-xs leading-5 text-gray-600">Bài Telegram mới dùng link và chữ đã lưu của tài khoản. Mọi chỉnh sửa ở đây chỉ lưu cho bài này; đổi loại bài không xóa nội dung đã nhập.</p></div>
    <details open={settingsOpen || showSettings} onToggle={event => setSettingsOpen(event.currentTarget.open)} className="rounded-xl border border-gray-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">{value.enabled ? 'Telegram đang bật' : 'Telegram đang tắt'} · Link, chữ trên nút và đoạn thông báo</summary>
      <div className="mt-4"><TelegramSettingsFields value={value} onChange={onChange} disabled={disabled || uploading} hideEnabledToggle={fixedMode} /></div>
    </details>
    {!fixedMode && !value.enabled && <button type="button" disabled={disabled || uploading} onClick={() => onChange({ ...value, enabled: true })} className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 disabled:opacity-50">Dùng mẫu Telegram cho bài này</button>}
    {value.enabled && <>
      <fieldset disabled={disabled || uploading} className="space-y-3 disabled:opacity-60">
        <label className="grid gap-1.5 text-sm font-medium text-gray-800">Tạo nhanh bằng URL video hoặc mã iframe
          <textarea rows={2} value={input} onChange={event => setInput(event.target.value)} placeholder="Dán URL video YouTube/Vimeo/TikTok/... hoặc link MP4" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={insertUrl} disabled={!input.trim()} className="rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Chèn video</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"><Upload className="h-4 w-4" /> Upload video / ảnh</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/ogg" onChange={event => void upload(event)} className="hidden" />
        </div>
        {content.trim() && <label className="flex items-start gap-2 text-xs text-gray-600"><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} className="mt-0.5 accent-sky-600" /> Thay toàn bộ nội dung bằng media mới (sẽ hỏi xác nhận). Mặc định chèn thêm và giữ nội dung hiện có.</label>}
        <p className="text-xs text-gray-500">Ảnh tối đa 8 MB, video tối đa 50 MB. Tiêu đề còn trống sẽ được tạo sau khi chèn; bài Telegram mới được cấp link số khi lưu.</p>
      </fieldset>
      {uploading && <p role="status" className="text-sm text-sky-700">Đang tải video/ảnh... Vui lòng chờ trước khi lưu bài.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {content.trim() && previews.length === 0 && <p className="text-xs text-amber-800">Bài này đang có nội dung cũ và sẽ được giữ nguyên khi lưu. Bạn có thể thêm video/ảnh; nếu cần sửa phần chữ cũ, đổi tạm sang Bài thường.</p>}
      {media.length > 0 && <fieldset disabled={disabled || uploading || !onContentChange} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3" aria-label="Video và ảnh đã chèn">
        <legend className="px-1 text-sm font-semibold text-gray-800">Video và ảnh đã chèn ({media.length})</legend>
        {media.map((item, index) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.kind === 'image' ? 'Ảnh' : 'Video'} {index + 1} · {item.title}</span>
          <button type="button" aria-label={`Xóa ${item.kind === 'image' ? 'ảnh' : 'video'} ${index + 1}`} onClick={() => deleteMedia(index)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Xóa</button>
        </div>)}
      </fieldset>}
      <details className="rounded-xl border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">Xem trước bố cục Telegram</summary>
        <div className="mx-auto mt-4 max-w-2xl space-y-5 py-2">
          <div className="text-center"><span className="inline-block max-w-full break-words rounded-full bg-[#229ED9] px-7 py-3 text-base font-bold text-white shadow-lg">{value.buttonText || '✈️ VÀO NHÓM TELEGRAM NGAY'}</span></div>
          {value.disclaimer && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{value.disclaimer}</p>}
          {previews.length ? previews.map((preview, index) => preview.kind === 'image' ? <Image key={index} src={preview.url} alt={preview.title} unoptimized width={960} height={540} className="h-auto w-full rounded-xl" />
            : preview.kind === 'video' ? <video key={index + ':' + preview.url} src={preview.url} controls preload="metadata" playsInline className="w-full rounded-xl bg-black" />
              : <iframe key={index + ':' + preview.url} src={preview.url} title={preview.title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className={`mx-auto w-full rounded-xl border-0 ${preview.portrait ? 'aspect-[9/16] max-w-[380px]' : 'aspect-video'}`} />)
            : <div className="grid aspect-video place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">Video/ảnh sẽ hiển thị ở đây</div>}
          <p className="text-center text-xs text-gray-500 underline">Chính sách bảo mật</p>
        </div>
        <p className="text-xs text-gray-500">Bản xem trước hiển thị các video/ảnh hợp lệ theo thứ tự đã chèn. Dùng nút Xóa ở danh sách phía trên để bỏ riêng từng video/ảnh; phần chữ còn lại được giữ nguyên.</p>
      </details>
    </>}
  </section>
}
