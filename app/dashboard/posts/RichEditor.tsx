'use client'

import { useEffect, useRef } from 'react'
import { Bold, ImagePlus, Italic, Link2, List, PlaySquare, Quote, Underline } from 'lucide-react'

type Props = { value: string; onChange: (value: string) => void }

export default function RichEditor({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value
  }, [value])

  function emit() {
    onChange(editorRef.current?.innerHTML || '')
  }

  function command(name: string, argument?: string) {
    editorRef.current?.focus()
    document.execCommand(name, false, argument)
    emit()
  }

  function insertImage(url: string) {
    if (!url) return
    command('insertImage', url)
  }

  function chooseImage() {
    fileRef.current?.click()
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 1_400_000) return
    const reader = new FileReader()
    reader.onload = () => insertImage(String(reader.result || ''))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function promptImage() {
    const url = window.prompt('URL ảnh (hoặc để trống để tải ảnh từ máy):', '')?.trim()
    if (url) insertImage(url)
    else chooseImage()
  }

  function promptVideo() {
    const input = window.prompt('URL video/embed (YouTube, TikTok...):', '')?.trim()
    if (!input) return
    let url: URL
    try { url = new URL(input) } catch { return }
    if (url.protocol !== 'https:') return
    if (url.hostname === 'youtu.be') url = new URL(`https://www.youtube.com/embed/${url.pathname.slice(1)}`)
    if (url.hostname.endsWith('youtube.com') && url.pathname === '/watch') url = new URL(`https://www.youtube.com/embed/${url.searchParams.get('v') || ''}`)
    const html = `<div class="video-embed"><iframe src="${url.href.replace(/"/g, '&quot;')}" title="Video" loading="lazy" allowfullscreen></iframe></div><p><br></p>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, html)
    emit()
  }

  function paste(event: React.ClipboardEvent<HTMLDivElement>) {
    const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'))
    if (!image) return
    event.preventDefault()
    if (image.size > 1_400_000) return
    const reader = new FileReader()
    reader.onload = () => insertImage(String(reader.result || ''))
    reader.readAsDataURL(image)
  }

  return <div className="overflow-hidden rounded-xl border border-gray-300 bg-white"><div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2"><button type="button" onClick={() => command('bold')} title="Đậm" className="rounded p-2 hover:bg-gray-200"><Bold className="h-4 w-4" /></button><button type="button" onClick={() => command('italic')} title="Nghiêng" className="rounded p-2 hover:bg-gray-200"><Italic className="h-4 w-4" /></button><button type="button" onClick={() => command('underline')} title="Gạch chân" className="rounded p-2 hover:bg-gray-200"><Underline className="h-4 w-4" /></button><button type="button" onClick={() => command('insertUnorderedList')} title="Danh sách" className="rounded p-2 hover:bg-gray-200"><List className="h-4 w-4" /></button><button type="button" onClick={() => command('formatBlock', 'blockquote')} title="Trích dẫn" className="rounded p-2 hover:bg-gray-200"><Quote className="h-4 w-4" /></button><button type="button" onClick={() => command('createLink', window.prompt('URL liên kết:', 'https://') || '')} title="Liên kết" className="rounded p-2 hover:bg-gray-200"><Link2 className="h-4 w-4" /></button><button type="button" onClick={promptImage} title="Ảnh" className="rounded p-2 hover:bg-gray-200"><ImagePlus className="h-4 w-4" /></button><button type="button" onClick={promptVideo} title="Nhúng video" className="rounded p-2 hover:bg-gray-200"><PlaySquare className="h-4 w-4" /></button><input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" /><span className="ml-auto text-xs text-gray-500">Dán ảnh hoặc dùng nút ảnh để chèn</span></div><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} onPaste={paste} className="prose prose-slate min-h-72 max-w-none px-4 py-3 text-sm outline-none" data-placeholder="Viết nội dung bài viết..." />
    <style jsx>{`.prose:empty:before{content:attr(data-placeholder);color:#94a3b8;pointer-events:none}.video-embed{margin:1rem 0;aspect-ratio:16/9}.video-embed iframe{width:100%;height:100%;border:0;border-radius:.75rem}`}</style>
  </div>
}
