'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Film, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { defaultPopupSettings, type PopupSettings } from '@/lib/popup-settings'

type Popup = {
  id: string
  name: string
  isActive: boolean
  imageUrl: string | null
  firstUrl: string
  secondUrl: string
  settings: PopupSettings
  _count?: { posts: number }
}

const blank = { name: '', firstUrl: '', secondUrl: '', imageUrl: '', isActive: true }

export default function PopupManager() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [form, setForm] = useState(blank)
  const [settings, setSettings] = useState<PopupSettings>(defaultPopupSettings())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const pageSize = 10

  const load = useCallback(async () => {
    const response = await fetch(`/api/popups?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Không tải được danh sách popup')
    setPopups(data.items || [])
    setTotal(data.total || 0)
  }, [page, query])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được danh sách popup')) }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function startCreate() {
    setEditingId(null); setForm(blank); setSettings(defaultPopupSettings()); setShowForm(true); setError('')
  }

  function edit(popup: Popup) {
    setEditingId(popup.id)
    setForm({ name: popup.name, firstUrl: popup.firstUrl, secondUrl: popup.secondUrl, imageUrl: popup.imageUrl || '', isActive: popup.isActive })
    setSettings(popup.settings || defaultPopupSettings(popup.firstUrl, popup.secondUrl))
    setShowForm(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() { setEditingId(null); setForm(blank); setSettings(defaultPopupSettings()); setShowForm(false) }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = { ...form, imageUrl: form.imageUrl || null, settings: { ...settings, shopee: { ...settings.shopee, url: form.firstUrl }, tiktok: { ...settings.tiktok, url: form.secondUrl, androidUrl: settings.tiktok.androidUrl || form.secondUrl, iosUrl: settings.tiktok.iosUrl || form.secondUrl } }, firstUrl: form.firstUrl, secondUrl: form.secondUrl }
      const response = await fetch(editingId ? `/api/popups/${editingId}` : '/api/popups', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lưu popup thất bại')
      reset(); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lưu popup thất bại') } finally { setBusy(false) }
  }

  async function remove(popup: Popup) {
    if (!window.confirm(`Xóa popup "${popup.name}"?`)) return
    setBusy(true); setError('')
    try { const response = await fetch(`/api/popups/${popup.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Xóa popup thất bại'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Xóa popup thất bại') } finally { setBusy(false) }
  }

  async function duplicate(popup: Popup) {
    setBusy(true); setError('')
    try { const response = await fetch(`/api/popups/${popup.id}/duplicate`, { method: 'POST' }); if (!response.ok) throw new Error('Nhân bản popup thất bại'); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Nhân bản popup thất bại') } finally { setBusy(false) }
  }

  async function uploadImage(file: File | undefined, field: 'imageUrl' | 'shopee' | 'tiktok') {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1_400_000) { setError('Ảnh phải là PNG, JPG, WebP hoặc GIF dưới 1.4 MB'); return }
    const reader = new FileReader(); reader.onload = () => field === 'imageUrl' ? setForm(current => ({ ...current, imageUrl: String(reader.result || '') })) : setSettings(current => ({ ...current, [field]: { ...current[field], imageUrl: String(reader.result || '') } }))
    reader.readAsDataURL(file)
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const activeCount = useMemo(() => popups.filter(item => item.isActive).length, [popups])

  return <div className="mx-auto max-w-7xl space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-600">Nội dung</p><h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">Quản lý popup</h1><p className="mt-2 text-sm text-gray-600">Shopee ở lượt 1, TikTok ở lượt 2. Popup tắt sẽ không được chọn cho bài mới.</p></div><button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="h-4 w-4" /> Tạo popup</button></div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm theo tên hoặc URL..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-sky-500" /></div><span className="text-sm text-gray-500">{activeCount} popup đang bật</span></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {showForm && <form onSubmit={save} className="space-y-5 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-950">{editingId ? 'Sửa mẫu popup' : 'Tạo mẫu popup'}</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-sky-600" /> Đang bật</label></div>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700">Tên mẫu<input required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2.5 outline-sky-500" placeholder="Ví dụ: Chiến dịch tháng 9" /></label>
      <div className="grid gap-4 md:grid-cols-2"><fieldset className="space-y-3 rounded-xl border border-gray-200 p-4"><legend className="px-1 text-sm font-semibold text-gray-800">Lượt 1 · Shopee</legend><label className="grid gap-1 text-xs text-gray-600">URL<input required type="url" value={form.firstUrl} onChange={event => { const value = event.target.value; setForm(current => ({ ...current, firstUrl: value })); setSettings(current => ({ ...current, shopee: { ...current.shopee, url: value } })) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.shopee.enabled} onChange={event => setSettings(current => ({ ...current, shopee: { ...current.shopee, enabled: event.target.checked } }))} /> Cho phép lượt này</label><label className="grid gap-1 text-xs text-gray-600">Delay (giây)<input type="number" min="0" max="3600" value={settings.shopee.delaySeconds} onChange={event => setSettings(current => ({ ...current, shopee: { ...current.shopee, delaySeconds: Number(event.target.value) } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><input value={settings.shopee.imageUrl || ''} onChange={event => setSettings(current => ({ ...current, shopee: { ...current.shopee, imageUrl: event.target.value || null } }))} placeholder="Ảnh popup URL" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><input type="file" accept="image/*" onChange={event => void uploadImage(event.target.files?.[0], 'shopee')} className="text-xs" /></fieldset>
        <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4"><legend className="px-1 text-sm font-semibold text-gray-800">Lượt 2 · TikTok</legend><label className="grid gap-1 text-xs text-gray-600">URL chung<input required type="url" value={form.secondUrl} onChange={event => { const value = event.target.value; setForm(current => ({ ...current, secondUrl: value })); setSettings(current => ({ ...current, tiktok: { ...current.tiktok, url: value, androidUrl: current.tiktok.androidUrl || value, iosUrl: current.tiktok.iosUrl || value } })) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="grid gap-1 text-xs text-gray-600">Android URL<input type="url" value={settings.tiktok.androidUrl} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, androidUrl: event.target.value } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="grid gap-1 text-xs text-gray-600">iOS URL<input type="url" value={settings.tiktok.iosUrl} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, iosUrl: event.target.value } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.tiktok.enabled} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, enabled: event.target.checked } }))} /> Cho phép lượt này</label><label className="grid gap-1 text-xs text-gray-600">Delay (giây)<input type="number" min="0" max="3600" value={settings.tiktok.delaySeconds} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, delaySeconds: Number(event.target.value) } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><input value={settings.tiktok.imageUrl || ''} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, imageUrl: event.target.value || null } }))} placeholder="Ảnh popup URL" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><input type="file" accept="image/*" onChange={event => void uploadImage(event.target.files?.[0], 'tiktok')} className="text-xs" /></fieldset></div>
      <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-1 text-sm text-gray-700">Ảnh chung<input value={form.imageUrl} onChange={event => setForm({ ...form, imageUrl: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2" placeholder="https://... hoặc data URL" /></label><label className="grid gap-1 text-sm text-gray-700">Cooldown (phút)<input type="number" min="0" max="10080" value={settings.cooldownMinutes} onChange={event => setSettings({ ...settings, cooldownMinutes: Number(event.target.value) })} className="rounded-lg border border-gray-300 px-3 py-2" /></label><div className="space-y-2 text-sm text-gray-700"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.forceChromeAndroid} onChange={event => setSettings({ ...settings, forceChromeAndroid: event.target.checked })} /> Hướng dẫn mở Chrome Android</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.forceSafariIos} onChange={event => setSettings({ ...settings, forceSafariIos: event.target.checked })} /> Hướng dẫn mở Safari iOS</label></div></div>
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu popup'}</button><button type="button" onClick={reset} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700">Hủy</button></div>
    </form>}
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Popup</th><th className="px-5 py-3">Hai lượt mở</th><th className="px-5 py-3">Bài viết</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{popups.map(popup => <tr key={popup.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-14 place-items-center rounded-lg bg-gray-950 bg-cover bg-center" style={popup.imageUrl ? { backgroundImage: `url("${popup.imageUrl.replaceAll('"', '%22')}")` } : undefined}><Film className="h-4 w-4 text-white" /></div><div><p className="font-semibold text-gray-950">{popup.name}</p><p className="text-xs text-gray-500">Cooldown {popup.settings?.cooldownMinutes ?? 30} phút</p></div></div></td><td className="max-w-[300px] px-5 py-4 text-xs text-gray-600"><p className="truncate">1. {popup.settings?.shopee?.url || popup.firstUrl}</p><p className="truncate">2. {popup.settings?.tiktok?.androidUrl || popup.secondUrl}</p></td><td className="px-5 py-4 text-gray-600">{popup._count?.posts ?? 0}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${popup.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{popup.isActive ? 'Đang bật' : 'Đang tắt'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button onClick={() => edit(popup)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50" title="Sửa"><Pencil className="h-4 w-4" /></button><button onClick={() => void duplicate(popup)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Nhân bản"><Copy className="h-4 w-4" /></button><button disabled={busy} onClick={() => void remove(popup)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa"><Trash2 className="h-4 w-4" /></button><Link href="/dashboard/posts" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Bài viết"><ExternalLink className="h-4 w-4" /></Link></div></td></tr>)}</tbody></table></div>{!popups.length && <p className="p-8 text-center text-sm text-gray-500">Chưa có popup phù hợp.</p>}<div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-600"><span>Trang {page}/{pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div></div>
  </div>
}
