'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from 'lucide-react'

type Block = { id: string; title: string; content: string; contentFormat: 'plain' | 'rich' | 'raw-html'; placement: 'before' | 'after'; sortOrder: number; isActive: boolean }
type Form = Omit<Block, 'id'>
const emptyForm: Form = { title: '', content: '', contentFormat: 'rich', placement: 'after', sortOrder: 0, isActive: true }

export default function FixedContentManager({ onClose, canUseRawHtml }: { onClose: () => void; canUseRawHtml: boolean }) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [form, setForm] = useState<Form>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/content-blocks', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Không tải được nội dung cố định')
    setBlocks(data)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được nội dung cố định')) }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function edit(block: Block) {
    setEditingId(block.id)
    setForm({ title: block.title, content: block.content, contentFormat: block.contentFormat, placement: block.placement, sortOrder: block.sortOrder, isActive: block.isActive })
  }

  function reset() { setEditingId(null); setForm(emptyForm) }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch(editingId ? `/api/content-blocks/${editingId}` : '/api/content-blocks', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lưu nội dung cố định thất bại')
      reset(); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lưu nội dung cố định thất bại') }
    finally { setBusy(false) }
  }

  async function toggle(block: Block) {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/content-blocks/${block.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: block.title, content: block.content, contentFormat: block.contentFormat, placement: block.placement, sortOrder: block.sortOrder, isActive: !block.isActive }) })
      if (!response.ok) throw new Error('Đổi trạng thái thất bại')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Đổi trạng thái thất bại') }
    finally { setBusy(false) }
  }

  async function remove(block: Block) {
    if (!window.confirm(`Xóa "${block.title}"?`)) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/content-blocks/${block.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Xóa nội dung cố định thất bại')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Xóa nội dung cố định thất bại') }
    finally { setBusy(false) }
  }

  async function move(block: Block, direction: -1 | 1) {
    const group = blocks.filter(item => item.placement === block.placement)
    const index = group.findIndex(item => item.id === block.id)
    if (index + direction < 0 || index + direction >= group.length) return
    const ids = group.map(item => item.id)
    ;[ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/content-blocks/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      if (!response.ok) throw new Error('Đổi thứ tự thất bại')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Đổi thứ tự thất bại') }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="Nội dung cố định"><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-gray-950">Nội dung cố định</h2><p className="mt-1 text-sm text-gray-500">Chèn ở đầu hoặc cuối tất cả bài viết của tài khoản.</p></div><button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng"><X className="h-5 w-5" /></button></div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <form onSubmit={save} className="mt-5 grid gap-3 rounded-xl border border-gray-200 bg-slate-50 p-4 sm:grid-cols-3"><input required maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Tên nội dung" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /><select value={form.placement} onChange={event => setForm({ ...form, placement: event.target.value as Form['placement'] })} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="before">Đầu bài</option><option value="after">Cuối bài</option></select><select value={form.contentFormat} onChange={event => setForm({ ...form, contentFormat: event.target.value as Form['contentFormat'] })} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="rich">Rich HTML</option><option value="plain">Văn bản</option>{canUseRawHtml && <option value="raw-html">Raw HTML (admin)</option>}</select><textarea required rows={4} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="Nội dung" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:col-span-3" /><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Đang bật</label><div className="flex gap-2 sm:col-span-2 sm:justify-end"><button disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editingId ? 'Cập nhật' : 'Thêm nội dung'}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Hủy sửa</button>}</div></form>
    <div className="mt-5 divide-y divide-gray-100">{blocks.map(block => <div key={block.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><div className="min-w-[180px] flex-1"><p className="font-semibold text-gray-950">{block.title}</p><p className="text-xs text-gray-500">{block.placement === 'before' ? 'Đầu bài' : 'Cuối bài'} · {block.contentFormat}</p></div><button disabled={busy} onClick={() => void toggle(block)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${block.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{block.isActive ? 'Đang bật' : 'Đang tắt'}</button><button disabled={busy} onClick={() => void move(block, -1)} className="rounded-lg p-2 hover:bg-gray-100" title="Lên"><ArrowUp className="h-4 w-4" /></button><button disabled={busy} onClick={() => void move(block, 1)} className="rounded-lg p-2 hover:bg-gray-100" title="Xuống"><ArrowDown className="h-4 w-4" /></button><button onClick={() => edit(block)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50" title="Sửa"><Pencil className="h-4 w-4" /></button><button disabled={busy} onClick={() => void remove(block)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa"><Trash2 className="h-4 w-4" /></button></div>)}{!blocks.length && <p className="py-6 text-center text-sm text-gray-500">Chưa có nội dung cố định.</p>}</div>
  </section></div>
}
