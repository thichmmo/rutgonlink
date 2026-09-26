'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Film, Pencil, Plus, Trash2 } from 'lucide-react'

type Popup = {
  id: string
  name: string
  imageUrl: string | null
  firstUrl: string
  secondUrl: string
  _count?: { posts: number }
}

const emptyForm = { name: '', imageUrl: '', firstUrl: '', secondUrl: '' }

export default function PopupManager() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/popups', { cache: 'no-store' })
    if (response.ok) setPopups(await response.json())
    else setError('Không tải được danh sách popup')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/popups', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Không tải được danh sách popup')))
      .then(data => setPopups(data))
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [])

  function edit(popup: Popup) {
    setEditingId(popup.id)
    setForm({ name: popup.name, imageUrl: popup.imageUrl || '', firstUrl: popup.firstUrl, secondUrl: popup.secondUrl })
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(editingId ? `/api/popups/${editingId}` : '/api/popups', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, imageUrl: form.imageUrl || null }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Lưu popup thất bại')
      reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lưu popup thất bại')
    } finally { setBusy(false) }
  }

  async function remove(popup: Popup) {
    if (!window.confirm(`Xóa popup "${popup.name}"? Bài viết sẽ vẫn còn nhưng không dùng popup này.`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/popups/${popup.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Xóa popup thất bại')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xóa popup thất bại')
    } finally { setBusy(false) }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1_400_000) {
      setError('Chọn ảnh PNG, JPG, WebP hoặc GIF dưới 1.4 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm(current => ({ ...current, imageUrl: String(reader.result || '') }))
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-600">Nội dung</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">Quản lý popup</h1>
          <p className="mt-2 text-sm text-gray-600">Một mẫu có thể dùng cho nhiều bài viết. Hai lượt bấm mở hai URL riêng rồi mới đóng lớp video.</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true) }} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Tạo popup</button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showForm && <form onSubmit={save} className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-semibold text-gray-950">{editingId ? 'Sửa mẫu popup' : 'Tạo mẫu popup'}</h2>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Tên mẫu
          <input required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="Ví dụ: Video chiến dịch tháng 9" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">URL mở ở lượt 1
            <input required type="url" value={form.firstUrl} onChange={event => setForm({ ...form, firstUrl: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="https://..." />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">URL mở ở lượt 2
            <input required type="url" value={form.secondUrl} onChange={event => setForm({ ...form, secondUrl: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="https://..." />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Ảnh nền video (URL hoặc tải lên)
          <input value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={event => setForm({ ...form, imageUrl: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="https://..." />
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => void uploadImage(event.target.files?.[0])} className="text-xs text-gray-500" />
        </label>
        {form.imageUrl && <div className="h-40 rounded-xl bg-gray-950 bg-cover bg-center" style={{ backgroundImage: `url("${form.imageUrl.replaceAll('"', '%22')}")` }} aria-label="Xem trước ảnh nền" />}
        <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu popup'}</button><button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700">Hủy</button></div>
      </form>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {popups.map(popup => <article key={popup.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="relative flex h-40 items-center justify-center bg-gray-950 bg-cover bg-center" style={popup.imageUrl ? { backgroundImage: `url("${popup.imageUrl.replaceAll('"', '%22')}")` } : undefined}>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-lg"><Film className="h-6 w-6" /></span>
          </div>
          <div className="space-y-3 p-5">
            <div><h2 className="font-semibold text-gray-950">{popup.name}</h2><p className="text-xs text-gray-500">{popup._count?.posts ?? 0} bài viết đang dùng</p></div>
            <div className="space-y-1 text-xs text-gray-500"><p className="truncate">1. {popup.firstUrl}</p><p className="truncate">2. {popup.secondUrl}</p></div>
            <div className="flex gap-2 border-t border-gray-100 pt-3"><button onClick={() => edit(popup)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-sky-700 hover:bg-sky-50"><Pencil className="h-4 w-4" /> Sửa</button><button disabled={busy} onClick={() => void remove(popup)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Xóa</button><Link href="/dashboard/posts" className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><ExternalLink className="h-4 w-4" /> Bài viết</Link></div>
          </div>
        </article>)}
        {!popups.length && <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500 md:col-span-2">Chưa có mẫu popup. Tạo mẫu đầu tiên để gán cho bài viết.</p>}
      </div>
    </div>
  )
}
