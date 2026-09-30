'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Copy, ExternalLink, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import RichEditor from './RichEditor'
import FixedContentManager from './FixedContentManager'
import { popupTiming, popupTimingLabel, type PopupTimingSettings } from '@/app/dashboard/popup-timing'
import { PopupTimingPreview } from '@/app/dashboard/PopupTiming'

type Popup = { id: string; name: string; isActive?: boolean; settings?: PopupTimingSettings | null }
type DomainOption = { id: string | null; domain: string; kind: 'primary' | 'shared' | 'custom' }
type Post = { id: string; title: string; slug: string; excerpt: string | null; content: string; contentFormat: string; popupId: string | null; popup: Popup | null; domainId: string | null; sharedDomain: string | null; previewImage: string | null; isFakeVideo: boolean; publicUrl: string; publicDomain: string; isPublished: boolean; updatedAt: string }
type Form = { title: string; slug: string; excerpt: string; content: string; contentFormat: string; popupIds: string[]; domainKey: string; previewImage: string; isFakeVideo: boolean; isPublished: boolean }

const emptyForm: Form = { title: '', slug: '', excerpt: '', content: '', contentFormat: 'rich', popupIds: [], domainKey: 'primary', previewImage: '', isFakeVideo: false, isPublished: false }

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function PostManager() {
  const [posts, setPosts] = useState<Post[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [domains, setDomains] = useState<DomainOption[]>([])
  const [canUseRawHtml, setCanUseRawHtml] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showBlocks, setShowBlocks] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [domainFilter, setDomainFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [uploadingPreview, setUploadingPreview] = useState(false)
  const [error, setError] = useState('')
  const previewImageRef = useRef<HTMLInputElement>(null)
  const previewPasteRef = useRef<HTMLDivElement>(null)
  const previewRequest = useRef(0)

  const load = useCallback(async () => {
    const [postsResponse, optionsResponse] = await Promise.all([
      fetch(`/api/posts?query=${encodeURIComponent(query)}&status=${status}&domain=${encodeURIComponent(domainFilter)}&page=${page}&pageSize=${pageSize}`, { cache: 'no-store' }),
      fetch('/api/posts/options', { cache: 'no-store' }),
    ])
    const postsData = await postsResponse.json()
    const optionsData = await optionsResponse.json()
    if (!postsResponse.ok || !optionsResponse.ok) throw new Error(postsData.error || optionsData.error || 'Không tải được dữ liệu')
    setPosts(postsData.items || [])
    setTotal(postsData.total || 0)
    setPopups(optionsData.popups || [])
    setDomains(optionsData.domains || [])
    setCanUseRawHtml(Boolean(optionsData.canUseRawHtml))
  }, [domainFilter, page, pageSize, query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu')) }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function startCreate() {
    previewRequest.current += 1
    setUploadingPreview(false)
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function edit(post: Post) {
    previewRequest.current += 1
    setUploadingPreview(false)
    setEditingId(post.id)
    setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content, contentFormat: post.contentFormat || 'plain', popupIds: post.popupId ? [post.popupId] : [], domainKey: post.domainId || (post.sharedDomain ? `shared:${post.sharedDomain}` : 'primary'), previewImage: post.previewImage || '', isFakeVideo: post.isFakeVideo, isPublished: post.isPublished })
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    previewRequest.current += 1
    setUploadingPreview(false)
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
  }

  function targetPayload() {
    const custom = domains.find(item => item.id === form.domainKey)
    if (custom?.kind === 'custom') return { domainId: custom.id, sharedDomain: null }
    if (form.domainKey.startsWith('shared:')) return { domainId: null, sharedDomain: form.domainKey.slice(7) }
    return { domainId: null, sharedDomain: null }
  }

  const uploadFile = useCallback(async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/content/upload', { method: 'POST', body })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Không thể tải tệp lên')
    return String(data.url)
  }, [])

  async function uploadPreview(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await uploadPreviewFile(file)
  }

  async function uploadPreviewFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh cho preview Facebook')
      return
    }
    const request = ++previewRequest.current
    setUploadingPreview(true)
    try {
      const url = await uploadFile(file)
      // A closed/reopened form or a newer image must not inherit this upload.
      if (request !== previewRequest.current) return
      setForm(current => ({ ...current, previewImage: url }))
      setError('')
    } catch (cause) {
      if (request === previewRequest.current) setError(cause instanceof Error ? cause.message : 'Không thể tải ảnh preview')
    } finally {
      if (request === previewRequest.current) setUploadingPreview(false)
    }
  }

  function pastePreview(event: React.ClipboardEvent<HTMLDivElement>) {
    const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'))
      || [...event.clipboardData.items]
        .find(item => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile()
    if (!image) return
    event.preventDefault()
    void uploadPreviewFile(image)
  }

  async function pastePreviewFromClipboard() {
    previewPasteRef.current?.focus()
    if (!navigator.clipboard?.read) {
      setError('Trình duyệt không cho đọc clipboard. Hãy dùng Ctrl/Cmd + V trong khung ảnh.')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(value => value.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        await uploadPreviewFile(new File([blob], 'facebook-preview.png', { type }))
        return
      }
      setError('Clipboard hiện không có ảnh.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể dán ảnh từ clipboard')
    }
  }

  function dropPreview(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const image = [...event.dataTransfer.files].find(file => file.type.startsWith('image/'))
    if (image) void uploadPreviewFile(image)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (uploadingPreview) return
    setBusy(true)
    setError('')
    try {
      const target = targetPayload()
      const payload = { title: form.title, slug: form.slug || slugify(form.title), excerpt: form.excerpt || null, content: form.content, contentFormat: form.contentFormat, previewImage: form.previewImage || null, isFakeVideo: form.isFakeVideo, isPublished: form.isPublished, ...target, ...(editingId ? { popupId: form.popupIds[0] || null } : { popupIds: form.popupIds }) }
      const response = await fetch(editingId ? `/api/posts/${editingId}` : '/api/posts', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lưu bài viết thất bại')
      reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lưu bài viết thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Xóa bài viết "${post.title}"?`)) return
    setBusy(true)
    try { const response = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Xóa bài viết thất bại'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Xóa bài viết thất bại') }
    finally { setBusy(false) }
  }

  async function duplicate(post: Post) {
    setBusy(true)
    try { const response = await fetch(`/api/posts/${post.id}/duplicate`, { method: 'POST' }); if (!response.ok) throw new Error('Nhân bản bài viết thất bại'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Nhân bản bài viết thất bại') }
    finally { setBusy(false) }
  }

  async function copyLink(post: Post) {
    await navigator.clipboard.writeText(post.publicUrl)
    setError(`Đã sao chép ${post.publicUrl}`)
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const selectedCount = form.popupIds.length
  // Options exclude inactive templates; retain their saved timing when editing an existing post.
  const editedPopup = posts.find(post => post.id === editingId)?.popup
  const selectedPopup = selectedCount === 1
    ? popups.find(popup => popup.id === form.popupIds[0]) || (editedPopup?.id === form.popupIds[0] ? editedPopup : null)
    : null
  const domainLabel = (domain: DomainOption) => `${domain.domain}${domain.kind === 'custom' ? ' · custom' : domain.kind === 'shared' ? ' · shared' : ' · chính'}`
  const previewDomain = domains.find(domain => (domain.kind === 'custom' ? domain.id : domain.kind === 'shared' ? `shared:${domain.domain}` : 'primary') === form.domainKey)?.domain || ''

  return <div className="mx-auto max-w-7xl space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-600">Nội dung</p><h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">Quản lý bài viết</h1><p className="mt-2 text-sm text-gray-600">Mỗi popup được chọn sẽ tạo một bài viết riêng khi xuất bản hàng loạt.</p></div><div className="flex gap-2"><button onClick={() => setShowBlocks(value => !value)} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Nội dung cố định</button><button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Tạo bài viết</button></div></div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm tiêu đề, slug..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-sky-500" /></div><select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Tất cả trạng thái</option><option value="published">Đã xuất bản</option><option value="draft">Bản nháp</option></select><select value={domainFilter} onChange={event => { setDomainFilter(event.target.value); setPage(1) }} className="max-w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Tất cả domain</option>{domains.map(domain => <option key={`filter:${domain.kind}:${domain.id || domain.domain}`} value={domain.domain}>{domain.domain}</option>)}</select><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="6">6 / trang</option><option value="10">10 / trang</option><option value="20">20 / trang</option><option value="25">25 / trang</option></select></div>
    {error && !showForm && <p role="alert" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{error}</p>}
    {showBlocks && <FixedContentManager canUseRawHtml={canUseRawHtml} onClose={() => setShowBlocks(false)} />}
    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 sm:p-4"><form onSubmit={save} className="flex max-h-[94vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={editingId ? 'Sửa bài viết' : 'Tạo bài viết'}>
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-7"><div><h2 className="text-lg font-semibold text-gray-950">{editingId ? 'Sửa bài viết' : 'Tạo bài viết'}</h2><p className="mt-0.5 text-sm text-gray-500">Tạo bài viết, chọn popup và chuẩn bị ảnh chia sẻ Facebook.</p></div><button type="button" onClick={reset} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
      {error && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-base font-semibold text-gray-950">Preview link trên Facebook</h3><p className="mt-1 text-xs text-gray-500">Ảnh này dùng khi chia sẻ link, không tự chèn vào nội dung bài viết.</p></div>
          <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-[#d61f51]">Facebook preview</span>
        </div>
        <div ref={previewPasteRef} tabIndex={0} aria-label="Khung dán ảnh preview Facebook" onPaste={pastePreview} onDrop={dropPreview} onDragOver={event => event.preventDefault()} className="mt-4 overflow-hidden rounded-2xl border border-gray-300 bg-white focus-visible:outline-2 focus-visible:outline-sky-500">
          <div className="grid min-h-40 grid-cols-[minmax(120px,.9fr)_1.35fr]">
            <div className="relative flex min-h-40 items-end justify-center overflow-hidden bg-slate-100">
              {form.previewImage ? <Image src={form.previewImage} alt="Ảnh preview Facebook" width={1200} height={630} unoptimized className="absolute inset-0 h-full w-full object-cover" /> : <span className="text-sm text-gray-400">Ảnh preview</span>}
              {form.isFakeVideo && form.previewImage && <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red-600 text-lg text-white shadow-xl">▶</span>}
              <div className="relative z-10 flex w-full flex-wrap gap-1.5 bg-black/10 p-2">
                <input ref={previewImageRef} type="file" accept="image/*" onChange={uploadPreview} className="hidden" />
                <button type="button" disabled={busy || uploadingPreview} onClick={() => previewImageRef.current?.click()} className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-white disabled:opacity-50">Upload</button>
                <button type="button" disabled={busy || uploadingPreview} onClick={() => void pastePreviewFromClipboard()} className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-white disabled:opacity-50">Dán ảnh</button>
                {form.previewImage && <button type="button" disabled={uploadingPreview} onClick={() => setForm(current => ({ ...current, previewImage: '' }))} className="ml-auto rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/80">Xóa</button>}
              </div>
            </div>
            <div className="flex min-w-0 flex-col justify-center break-words p-4"><p className="text-base font-semibold leading-snug text-gray-900">{form.title || 'Tiêu đề preview của link'}</p><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">{form.excerpt || 'Mô tả ngắn sẽ hiển thị ở đây khi chia sẻ link.'}</p><p className="mt-4 text-[11px] text-gray-400">{form.slug || 'tu-dong-theo-tieu-de'} · {previewDomain}</p></div>
          </div>
          <div className="flex items-center gap-5 border-t border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-500"><span>11 giờ</span><span>Thích</span><span>Trả lời</span></div>
        </div>
        <div className="mt-3 flex gap-2"><input disabled={uploadingPreview} value={form.previewImage} onChange={event => setForm(current => ({ ...current, previewImage: event.target.value }))} placeholder="Dán URL ảnh preview..." className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
        <p className="mt-1 text-[11px] text-gray-500">Kéo thả hoặc dán ảnh trực tiếp vào khung, hoặc nhập URL ảnh công khai.</p>
        {uploadingPreview && <p role="status" className="mt-2 text-xs text-sky-700">Đang tải ảnh preview...</p>}
      </section>
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium text-gray-700">Tiêu đề<input required maxLength={200} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value, slug: editingId ? current.slug : slugify(event.target.value) }))} className="rounded-lg border border-gray-300 px-3 py-2.5" /></label><label className="grid gap-1.5 text-sm font-medium text-gray-700">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => setForm(current => ({ ...current, slug: slugify(event.target.value) }))} className="rounded-lg border border-gray-300 px-3 py-2.5" /></label></div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-slate-50 px-4 py-3"><span><span className="block text-sm font-semibold text-gray-800">Ảnh giả video</span><span className="block text-xs font-normal text-gray-500">Thêm nút Play ở giữa ảnh preview khi chia sẻ link.</span></span><input type="checkbox" checked={form.isFakeVideo} onChange={event => setForm(current => ({ ...current, isFakeVideo: event.target.checked }))} className="h-5 w-5 accent-sky-600" /></label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700">Domain<select value={form.domainKey} onChange={event => setForm(current => ({ ...current, domainKey: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2.5">{domains.map(domain => <option key={`${domain.kind}:${domain.id || domain.domain}`} value={domain.kind === 'custom' ? domain.id || '' : domain.kind === 'shared' ? `shared:${domain.domain}` : 'primary'}>{domainLabel(domain)}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700">Mô tả ngắn<textarea rows={2} maxLength={1000} value={form.excerpt} onChange={event => setForm(current => ({ ...current, excerpt: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2.5" /></label>
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]"><div className="grid gap-1.5 text-sm font-medium text-gray-700"><span>Nội dung bài viết</span>{form.contentFormat === 'rich' ? <RichEditor value={form.content} onChange={content => setForm(current => ({ ...current, content }))} onUpload={uploadFile} canUseRawHtml={canUseRawHtml} /> : <textarea required rows={16} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm" placeholder={form.contentFormat === 'raw-html' ? '<p>HTML/Script...</p>' : 'Viết nội dung dạng văn bản...'} />}</div><div className="space-y-4"><label className="grid gap-1.5 text-sm font-medium text-gray-700">Định dạng<select value={form.contentFormat} onChange={event => setForm(current => ({ ...current, contentFormat: event.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2.5"><option value="plain">Plain text</option><option value="rich">Rich text / HTML đã lọc</option>{canUseRawHtml && <option value="raw-html">Raw HTML / Script (admin)</option>}</select></label><fieldset className="rounded-xl border border-gray-200 p-3"><legend className="px-1 text-xs font-semibold text-gray-700">Popup {selectedCount ? `(${selectedCount})` : ''}</legend><div className="max-h-56 space-y-2 overflow-y-auto">{popups.map(popup => { const timing = popupTiming(popup.settings); return <label key={popup.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.popupIds.includes(popup.id)} onChange={event => setForm(current => ({ ...current, popupIds: event.target.checked ? [...current.popupIds, popup.id] : current.popupIds.filter(id => id !== popup.id) }))} className="mt-1 h-4 w-4 accent-sky-600" /><span className="min-w-0"><span className="block">{popup.name}</span><span className="mt-0.5 block text-[11px] font-medium text-gray-500" aria-label={`Bộ đếm ${popupTimingLabel(popup.settings)}`}>S {timing.shopeeSeconds}s · T {timing.tiktokSeconds}s · Cooldown {timing.cooldownMinutes}m</span></span></label> })}{!popups.length && <p className="text-xs text-gray-500">Chưa có popup bật.</p>}</div></fieldset>{selectedPopup && <><PopupTimingPreview key={selectedPopup.id} settings={selectedPopup.settings} name="Bộ đếm bài viết" />{selectedPopup.isActive === false && <p className="text-xs text-amber-700">Popup đang tắt: bài viết hiển thị ngay, không chạy bộ đếm.</p>}</>}<label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium"><input type="checkbox" checked={form.isPublished} onChange={event => setForm(current => ({ ...current, isPublished: event.target.checked }))} className="h-4 w-4 accent-sky-600" /> Xuất bản ngay</label></div></div>
      </div><div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:px-7"><button type="button" onClick={reset} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">Hủy</button><button disabled={busy || uploadingPreview} className="rounded-lg bg-[#d61f51] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : editingId ? 'Cập nhật bài' : form.popupIds.length > 1 ? `Tạo ${form.popupIds.length} bài` : 'Lưu bài viết'}</button></div>
    </form></div>}
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="divide-y divide-gray-100">{posts.map(post => { const timing = popupTiming(post.popup?.settings); return <article key={post.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-950">{post.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${post.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{post.isPublished ? 'Đã xuất bản' : 'Bản nháp'}</span>{post.isFakeVideo && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Fake video</span>}</div><p className="truncate text-xs text-gray-500">{post.publicDomain}/{post.slug} · Popup: {post.popup?.name || 'Không có'}</p>{post.popup && <p className="text-[11px] font-medium text-gray-500" aria-label={`Bộ đếm ${popupTimingLabel(post.popup.settings)}`}>Bộ đếm: S {timing.shopeeSeconds}s · T {timing.tiktokSeconds}s · Cooldown {timing.cooldownMinutes}m</p>}{post.excerpt && <p className="line-clamp-1 text-sm text-gray-600">{post.excerpt}</p>}</div><div className="flex shrink-0 flex-wrap gap-1">{post.isPublished && <><a href={post.publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Mở bài"><ExternalLink className="h-4 w-4" /></a><button onClick={() => void copyLink(post)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Sao chép link"><Copy className="h-4 w-4" /></button></>}<button onClick={() => edit(post)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50" title="Sửa"><Pencil className="h-4 w-4" /></button><button disabled={busy} onClick={() => void duplicate(post)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Nhân bản"><Copy className="h-4 w-4" /></button><button disabled={busy} onClick={() => void remove(post)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa"><Trash2 className="h-4 w-4" /></button></div></article> })}{!posts.length && <div className="flex items-center gap-3 p-8 text-sm text-gray-500"><FileText className="h-5 w-5" /> Chưa có bài viết.</div>}</div><div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-600"><span>Trang {page}/{pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div></div>
  </div>
}
