'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Bold, Code2, FileCode2, ImagePlus, Italic, Link2, List, PlaySquare, Quote, Underline, Video } from 'lucide-react'
import { MANAGED_MEDIA_CSS, normalizeVideoEmbedUrl, videoEmbedHtml } from '@/lib/video-embed'

type Props = {
  value: string
  onChange: (value: string) => void
  onUpload?: (file: File) => Promise<string>
  canUseRawHtml?: boolean
}

const IMAGE_FALLBACK_LIMIT = 1_400_000

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được tệp'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export default function RichEditor({ value, onChange, onUpload, canUseRawHtml = false }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [sourceMode, setSourceMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showVideo, setShowVideo] = useState(false)
  const [videoInput, setVideoInput] = useState('')
  const [videoError, setVideoError] = useState('')

  useEffect(() => {
    if (!sourceMode && editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [sourceMode, value])

  function emit() {
    onChange(editorRef.current?.innerHTML || '')
  }

  function saveSelection() {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange()
  }

  function restoreSelection() {
    const editor = editorRef.current
    if (!editor) return
    let range = savedRangeRef.current
    // Source-mode switches replace the editor node, invalidating the old caret.
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  function command(name: string, argument?: string) {
    editorRef.current?.focus()
    document.execCommand(name, false, argument)
    emit()
  }

  function insertHtml(html: string) {
    if (!html) return
    if (sourceMode) { onChange(value + html); return }
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    emit()
  }

  function insertImage(url: string) {
    insertHtml(`<p><img src="${escapeAttribute(url)}" alt="" /></p>`)
  }

  function insertVideo(url: string, mimeType = '') {
    insertHtml(`<figure class="video-embed"><video controls preload="metadata" playsinline><source src="${escapeAttribute(url)}"${mimeType ? ` type="${escapeAttribute(mimeType)}"` : ''}></video></figure><p><br></p>`)
  }

  async function uploadFile(file: File, kind: 'image' | 'video') {
    setMessage('')
    const accepted = kind === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/')
    if (!accepted) {
      setMessage(kind === 'image' ? 'Vui lòng chọn tệp hình ảnh.' : 'Vui lòng chọn tệp video.')
      return
    }
    if (!onUpload && kind === 'image' && file.size > IMAGE_FALLBACK_LIMIT) {
      setMessage('Ảnh tải trực tiếp phải nhỏ hơn 1.4MB.')
      return
    }
    if (!onUpload && kind === 'video') {
      setMessage('Video cần được tải lên máy chủ trước khi chèn.')
      return
    }
    setBusy(true)
    try {
      const url = onUpload ? await onUpload(file) : await readAsDataUrl(file)
      if (kind === 'image') insertImage(url)
      else insertVideo(url, file.type)
      setMessage(`${kind === 'image' ? 'Đã tải ảnh' : 'Đã tải video'} lên.`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể tải tệp lên.')
    } finally {
      setBusy(false)
    }
  }

  function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadFile(file, 'image')
  }

  function handleVideoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadFile(file, 'video')
  }

  function promptImage() {
    saveSelection()
    const url = window.prompt('URL ảnh (hoặc bấm Hủy để tải ảnh từ máy):', '')?.trim()
    if (url) insertImage(url)
    else imageFileRef.current?.click()
  }

  function promptVideo() {
    saveSelection()
    setVideoInput('')
    setVideoError('')
    setShowVideo(true)
  }

  function submitVideo() {
    const embed = normalizeVideoEmbedUrl(videoInput)
    if (!embed) {
      setVideoError('Dán URL video công khai hoặc mã iframe từ YouTube, Vimeo, TikTok, Facebook, Instagram, Google Drive; hoặc link MP4/WebM/OGG. Với TikTok, dùng link đầy đủ dạng /@ten/video/ID.')
      return
    }
    insertHtml(videoEmbedHtml(embed))
    setShowVideo(false)
    setMessage(`Đã chèn ${embed.title}.`)
  }

  function promptHtml() {
    saveSelection()
    const html = window.prompt('Dán HTML/Script cần chèn:', '')?.trim()
    if (html) insertHtml(html)
  }

  function paste(event: React.ClipboardEvent<HTMLDivElement>) {
    const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'))
      || [...event.clipboardData.items].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile()
    if (!image) return
    event.preventDefault()
    void uploadFile(image, 'image')
  }

  function toolbarMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    saveSelection()
  }

  const actionClass = 'inline-flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-gray-600 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-wait disabled:opacity-50'

  return <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
    <div className="border-b border-gray-200 bg-white p-2">
      <div className="flex flex-wrap items-center gap-1">
        <select aria-label="Kiểu đoạn" defaultValue="p" onChange={event => command('formatBlock', event.target.value)} className="h-9 rounded-lg border-0 bg-gray-50 px-2 text-xs text-gray-600 outline-none">
          <option value="p">Normal</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('bold')} title="Đậm" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Bold className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('italic')} title="Nghiêng" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Italic className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('underline')} title="Gạch chân" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Underline className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('strikeThrough')} title="Gạch ngang" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><span className="text-base font-semibold line-through">S</span></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('insertUnorderedList')} title="Danh sách" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><List className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('formatBlock', 'blockquote')} title="Trích dẫn" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Quote className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('createLink', window.prompt('URL liên kết:', 'https://') || '')} title="Liên kết" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Link2 className="h-4 w-4" /></button>
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => command('removeFormat')} title="Xóa định dạng" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><Code2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-1">
        <button type="button" disabled={busy} onMouseDown={toolbarMouseDown} onClick={() => imageFileRef.current?.click()} className={actionClass}><ImagePlus className="h-5 w-5" /><span>Upload ảnh</span></button>
        <button type="button" disabled={busy} onMouseDown={toolbarMouseDown} onClick={() => videoFileRef.current?.click()} className={actionClass}><Video className="h-5 w-5" /><span>Upload video</span></button>
        <button type="button" disabled={busy} onMouseDown={toolbarMouseDown} onClick={promptVideo} className={actionClass}><PlaySquare className="h-5 w-5" /><span>Nhúng video</span></button>
        {canUseRawHtml && <button type="button" disabled={busy} onMouseDown={toolbarMouseDown} onClick={promptHtml} className={actionClass}><FileCode2 className="h-5 w-5" /><span>Nhúng HTML/Script</span></button>}
        <button type="button" onMouseDown={toolbarMouseDown} onClick={() => { setSourceMode(mode => !mode); setMessage('') }} className={`${actionClass} ${sourceMode ? 'bg-sky-100 text-sky-700' : ''}`}><Code2 className="h-5 w-5" /><span>Mã nguồn</span></button>
        <button type="button" disabled={busy} onMouseDown={toolbarMouseDown} onClick={promptImage} className="ml-auto rounded-lg px-2 py-2 text-xs text-gray-500 hover:bg-gray-100" title="Chèn ảnh bằng URL">Ảnh URL</button>
      </div>
      <input ref={imageFileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      <input ref={videoFileRef} type="file" accept="video/mp4,video/webm,video/ogg" onChange={handleVideoFile} className="hidden" />
      {message && <p className="px-2 pt-2 text-xs text-sky-700" role="status">{message}</p>}
    </div>
    {showVideo && <div className="space-y-3 border-b border-sky-200 bg-sky-50 p-4" role="group" aria-label="Nhúng video">
      <label className="grid gap-2 text-sm font-semibold text-gray-800">URL video hoặc mã iframe
        <textarea autoFocus rows={3} value={videoInput} onChange={event => setVideoInput(event.target.value)} placeholder="https://vimeo.com/... hoặc <iframe src=...></iframe>" className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm" />
      </label>
      <p className="text-xs text-gray-600">YouTube, Vimeo, TikTok, Facebook, Instagram, Google Drive hoặc video MP4/WebM/OGG. Video cần cho phép xem công khai và nhúng.</p>
      {videoError && <p role="alert" className="text-sm text-red-700">{videoError}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowVideo(false)} className="rounded-lg border bg-white px-3 py-2 text-sm">Hủy nhúng</button><button type="button" onClick={submitVideo} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">Chèn video</button></div>
    </div>}
    {/<iframe\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(value) && <p role="status" className="bg-amber-50 px-4 py-3 text-xs text-amber-900">Video cũ đã mất URL nguồn khi lưu. Hãy xóa khung trống trong Mã nguồn và nhúng lại link video gốc.</p>}
    {sourceMode
      ? <textarea value={value} onChange={event => onChange(event.target.value)} className="min-h-72 w-full resize-y px-4 py-3 font-mono text-xs leading-6 outline-none" aria-label="Mã nguồn HTML" />
      : <div ref={editorRef} contentEditable role="textbox" aria-label="Nội dung bài viết" aria-multiline="true" suppressContentEditableWarning onInput={emit} onBlur={emit} onPaste={paste} onKeyUp={saveSelection} onMouseUp={saveSelection} className="managed-rich-content prose prose-slate min-h-72 max-w-none px-4 py-3 text-sm outline-none" data-placeholder="Nhập nội dung bài viết..." />}
    <style>{MANAGED_MEDIA_CSS}</style>
    <style jsx>{`.prose:empty:before{content:attr(data-placeholder);color:#94a3b8;pointer-events:none}`}</style>
  </div>
}
