'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react'

type Popup = { id: string; name: string }
type Post = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  popupId: string | null
  popup: Popup | null
  isPublished: boolean
  updatedAt: string
}
const emptyForm = { title: '', slug: '', excerpt: '', content: '', popupId: '', isPublished: false }

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function PostManager() {
  const [posts, setPosts] = useState<Post[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [postsResponse, popupsResponse] = await Promise.all([
      fetch('/api/posts', { cache: 'no-store' }), fetch('/api/popups', { cache: 'no-store' }),
    ])
    if (postsResponse.ok && popupsResponse.ok) {
      setPosts(await postsResponse.json())
      setPopups(await popupsResponse.json())
    } else setError('Không tải được danh sách bài viết')
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetch('/api/posts', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/popups', { cache: 'no-store', signal: controller.signal }),
    ]).then(async ([postsResponse, popupsResponse]) => {
      if (!postsResponse.ok || !popupsResponse.ok) throw new Error('Không tải được danh sách bài viết')
      return Promise.all([postsResponse.json(), popupsResponse.json()])
    }).then(([postData, popupData]) => { setPosts(postData); setPopups(popupData) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [])

  function reset() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  function edit(post: Post) {
    setEditingId(post.id)
    setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content, popupId: post.popupId || '', isPublished: post.isPublished })
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(editingId ? `/api/posts/${editingId}` : '/api/posts', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, popupId: form.popupId || null, excerpt: form.excerpt || null }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Lưu bài viết thất bại')
      reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lưu bài viết thất bại')
    } finally { setBusy(false) }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Xóa bài viết "${post.title}"?`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Xóa bài viết thất bại')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xóa bài viết thất bại')
    } finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-600">Nội dung</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">Quản lý bài viết</h1>
        <p className="mt-2 text-sm text-gray-600">Bài viết hiển thị trên Rutgonlink. Chọn mẫu popup để đặt lớp video trung gian lên bài viết.</p>
      </div>
      <button onClick={() => { reset(); setShowForm(true) }} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Tạo bài viết</button>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

    {showForm && <form onSubmit={save} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-gray-950">{editingId ? 'Sửa bài viết' : 'Tạo bài viết'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Tiêu đề
          <input required maxLength={200} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value, slug: editingId || current.slug !== slugify(current.title) ? current.slug : slugify(event.target.value) }))} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Đường dẫn /posts/...
          <input required maxLength={190} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => setForm({ ...form, slug: slugify(event.target.value) })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700">Mô tả ngắn
        <textarea rows={2} maxLength={1000} value={form.excerpt} onChange={event => setForm({ ...form, excerpt: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700">Nội dung
        <textarea required rows={14} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="Viết bài ở đây. Xuống dòng để tách đoạn; bắt đầu dòng bằng # hoặc ## để tạo tiêu đề." />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">Mẫu popup
          <select value={form.popupId} onChange={event => setForm({ ...form, popupId: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500"><option value="">Không dùng popup</option>{popups.map(popup => <option key={popup.id} value={popup.id}>{popup.name}</option>)}</select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.isPublished} onChange={event => setForm({ ...form, isPublished: event.target.checked })} className="h-4 w-4 accent-sky-600" /> Xuất bản bài viết</label>
      </div>
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu bài viết'}</button><button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700">Hủy</button></div>
    </form>}

    <div className="space-y-3">
      {posts.map(post => <article key={post.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-950">{post.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${post.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{post.isPublished ? 'Đã xuất bản' : 'Bản nháp'}</span></div>
          <p className="truncate text-xs text-gray-500">/posts/{post.slug} · Popup: {post.popup?.name || 'Không có'}</p>
          {post.excerpt && <p className="line-clamp-1 text-sm text-gray-600">{post.excerpt}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {post.isPublished && <><a href={`/posts/${post.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Xem bài"><ExternalLink className="h-4 w-4" /></a><button onClick={() => void navigator.clipboard.writeText(`${location.origin}/posts/${post.slug}`)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Sao chép link"><Copy className="h-4 w-4" /></button></>}
          <button onClick={() => edit(post)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50" title="Sửa"><Pencil className="h-4 w-4" /></button>
          <button disabled={busy} onClick={() => void remove(post)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa"><Trash2 className="h-4 w-4" /></button>
        </div>
      </article>)}
      {!posts.length && <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500"><FileText className="h-5 w-5" /> Chưa có bài viết. Tạo bài đầu tiên để chia sẻ.</div>}
    </div>
  </div>
}
