'use client'

/* Default creatives can be user-provided URLs; keep the browser-native image path. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Film, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import {
  DEFAULT_SHOPEE_IMAGE_URL,
  DEFAULT_TIKTOK_IMAGE_URL,
  defaultPopupSettings,
  type PopupSettings,
} from '@/lib/popup-settings'

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

type ImageField = 'shopee' | 'tiktok'

const emptyForm = { name: '', firstUrl: '', secondUrl: '', imageUrl: '', isActive: true }

function backgroundImage(url: string | null | undefined) {
  return url ? { backgroundImage: `url("${url.replaceAll('"', '%22')}")` } : undefined
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label?: string }) {
  return <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
    {label && <span>{label}</span>}
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" />
    <span className="relative h-5 w-9 rounded-full bg-gray-200 transition peer-checked:bg-[#d61f51] peer-focus-visible:ring-2 peer-focus-visible:ring-[#d61f51]/30 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4" />
  </label>
}

export default function PopupManager() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [form, setForm] = useState(emptyForm)
  const [settings, setSettings] = useState<PopupSettings>(defaultPopupSettings())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<Popup | null>(null)
  const shopeeFileRef = useRef<HTMLInputElement>(null)
  const tiktokFileRef = useRef<HTMLInputElement>(null)
  const pageSize = 10

  const load = useCallback(async () => {
    const response = await fetch(`/api/popups?query=${encodeURIComponent(query)}&status=${status}&page=${page}&pageSize=${pageSize}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Không tải được danh sách popup')
    setPopups(data.items || [])
    setTotal(data.total || 0)
  }, [page, query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được danh sách popup')) }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setSettings(defaultPopupSettings())
    setShowForm(true)
    setError('')
  }

  function edit(popup: Popup) {
    setEditingId(popup.id)
    setForm({ name: popup.name, firstUrl: popup.firstUrl, secondUrl: popup.secondUrl, imageUrl: popup.imageUrl || '', isActive: popup.isActive })
    setSettings(popup.settings || defaultPopupSettings(popup.firstUrl, popup.secondUrl))
    setShowForm(true)
    setError('')
  }

  function reset() {
    setEditingId(null)
    setForm(emptyForm)
    setSettings(defaultPopupSettings())
    setShowForm(false)
  }

  function updateUrl(field: 'firstUrl' | 'secondUrl', value: string) {
    setForm(current => ({ ...current, [field]: value }))
    if (field === 'firstUrl') setSettings(current => ({ ...current, shopee: { ...current.shopee, url: value } }))
    else setSettings(current => ({ ...current, tiktok: { ...current.tiktok, url: value, androidUrl: value, iosUrl: value } }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl || null,
        firstUrl: form.firstUrl,
        secondUrl: form.secondUrl,
        settings: {
          ...settings,
          shopee: { ...settings.shopee, url: form.firstUrl, imageUrl: settings.shopee.imageUrl || DEFAULT_SHOPEE_IMAGE_URL },
          tiktok: {
            ...settings.tiktok,
            url: form.secondUrl,
            androidUrl: settings.tiktok.androidUrl || form.secondUrl,
            iosUrl: settings.tiktok.iosUrl || form.secondUrl,
            imageUrl: settings.tiktok.imageUrl || DEFAULT_TIKTOK_IMAGE_URL,
          },
        },
      }
      const response = await fetch(editingId ? `/api/popups/${editingId}` : '/api/popups', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Lưu popup thất bại')
      reset()
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lưu popup thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function remove(popup: Popup) {
    if (!window.confirm(`Xóa popup "${popup.name}"?`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/popups/${popup.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Xóa popup thất bại')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xóa popup thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function duplicate(popup: Popup) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/popups/${popup.id}/duplicate`, { method: 'POST' })
      if (!response.ok) throw new Error('Nhân bản popup thất bại')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nhân bản popup thất bại')
    } finally {
      setBusy(false)
    }
  }

  async function viewLinks(popup: Popup) {
    const response = await fetch(`/api/popups/${popup.id}/links`, { cache: 'no-store' })
    if (!response.ok) {
      setError('Không tải được link popup')
      return
    }
    const details = await response.json()
    setViewing({ ...popup, settings: details.settings, firstUrl: details.firstUrl, secondUrl: details.secondUrl })
  }

  async function resolveAffiliate(platform: ImageField) {
    const url = platform === 'shopee' ? form.firstUrl : form.secondUrl
    if (!url) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/content/resolve-affiliate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Không xử lý được link')
      const resolvedUrl = result.url || url
      if (platform === 'shopee') {
        updateUrl('firstUrl', resolvedUrl)
        setSettings(current => ({ ...current, shopee: { ...current.shopee, url: resolvedUrl, imageUrl: result.image || current.shopee.imageUrl } }))
      } else {
        updateUrl('secondUrl', resolvedUrl)
        setSettings(current => ({ ...current, tiktok: { ...current.tiktok, url: resolvedUrl, androidUrl: resolvedUrl, iosUrl: resolvedUrl, imageUrl: result.image || current.tiktok.imageUrl } }))
      }
      if (result.warning) setError(result.warning)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xử lý được link')
    } finally {
      setBusy(false)
    }
  }

  async function uploadImage(file: File | undefined, field: ImageField) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp hình ảnh.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/content/upload', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không thể tải ảnh lên')
      const url = String(data.url)
      setSettings(current => ({ ...current, [field]: { ...current[field], imageUrl: url } }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên')
    } finally {
      setBusy(false)
    }
  }

  function pasteImage(event: React.ClipboardEvent, field: ImageField) {
    const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'))
    if (!image) return
    event.preventDefault()
    void uploadImage(image, field)
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const activeCount = useMemo(() => popups.filter(item => item.isActive).length, [popups])

  return <div className="mx-auto max-w-6xl space-y-5">
    {viewing && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="Liên kết popup">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#d61f51]">Chi tiết popup</p><h2 className="mt-1 text-lg font-bold text-gray-950">{viewing.name}</h2></div><button type="button" onClick={() => setViewing(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng"><X className="h-5 w-5" /></button></div>
        <div className="mt-4 space-y-2">{[['Shopee', viewing.settings.shopee.url], ['TikTok Android', viewing.settings.tiktok.androidUrl || viewing.secondUrl], ['TikTok iOS', viewing.settings.tiktok.iosUrl || viewing.secondUrl]].map(([label, url]) => <div key={label} className="rounded-xl border border-gray-200 p-3"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><p className="mt-1 break-all text-sm text-gray-800">{url}</p><button type="button" onClick={() => void navigator.clipboard.writeText(url)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#d61f51]"><Copy className="h-3.5 w-3.5" /> Sao chép</button></div>)}</div>
      </div>
    </div>}

    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d61f51]">Nội dung</p><h1 className="mt-1 text-2xl font-bold text-gray-950">Quản lý popup</h1><p className="mt-1 text-sm text-gray-500">Cấu hình Shopee lượt 1 và TikTok lượt 2 cho bài viết.</p></div><button type="button" onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-[#d61f51] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#bd1846]"><Plus className="h-4 w-4" /> Tạo popup</button></div>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm theo tên hoặc URL..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-[#d61f51]" /></div><select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="all">Tất cả trạng thái</option><option value="active">Đang bật</option><option value="inactive">Đang tắt</option></select><span className="px-2 text-xs text-gray-500">{activeCount} đang bật</span></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 sm:p-4"><form onSubmit={save} className="flex max-h-[94vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={editingId ? 'Chỉnh sửa popup' : 'Tạo popup'}>
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-7"><div><h2 className="text-lg font-semibold text-gray-950">{editingId ? 'Chỉnh sửa popup' : 'Tạo popup'}</h2><p className="mt-0.5 text-sm text-gray-500">Cập nhật đầy đủ thông tin popup affiliate.</p></div><button type="button" onClick={reset} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium text-gray-700">Tên popup<input required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-[#d61f51]" placeholder="Popup Shopee + TikTok" /></label><div className="grid gap-1 text-sm font-medium text-gray-700"><span>Trạng thái popup</span><div className="flex h-[38px] items-center justify-between rounded-lg border border-gray-300 px-3"><span className="text-sm text-gray-700">{form.isActive ? 'Đang bật' : 'Đang tắt'}</span><Toggle checked={form.isActive} onChange={value => setForm(current => ({ ...current, isActive: value }))} /></div></div></div>
          <div><p className="mb-2 text-sm font-semibold text-gray-800">Nền tảng</p><div className="space-y-2">
            <fieldset className="rounded-xl border border-gray-200 p-3"><div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-2"><Toggle checked={settings.shopee.enabled} onChange={value => setSettings(current => ({ ...current, shopee: { ...current.shopee, enabled: value } }))} /><span className="font-semibold text-gray-900">🛍️ Shopee</span><div className="ml-auto flex flex-wrap items-center gap-2"><Toggle label="Android" checked={settings.shopee.androidEnabled} onChange={value => setSettings(current => ({ ...current, shopee: { ...current.shopee, androidEnabled: value } }))} /><Toggle label="iOS" checked={settings.shopee.iosEnabled} onChange={value => setSettings(current => ({ ...current, shopee: { ...current.shopee, iosEnabled: value } }))} /><label className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500">Hiển thị sau<input type="number" min="0" max="3600" value={settings.shopee.delaySeconds} onChange={event => setSettings(current => ({ ...current, shopee: { ...current.shopee, delaySeconds: Number(event.target.value) } }))} className="w-10 border-0 p-0 text-center text-xs outline-none" /> giây</label></div></div><label className="mt-2 grid gap-1 text-xs font-medium text-gray-700">Link Shopee Desktop<input required type="url" value={form.firstUrl} onChange={event => updateUrl('firstUrl', event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://shopee.vn/..." /></label><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-[11px] text-gray-500">Hỗ trợ link ngắn Shopee, hệ thống giữ nguyên URL hợp lệ.</span><button type="button" disabled={busy} onClick={() => void resolveAffiliate('shopee')} className="ml-auto rounded-md border border-[#f1b4c4] px-2.5 py-1 text-[11px] font-semibold text-[#d61f51]">Xử lý affiliate</button></div></fieldset>
            <fieldset className="rounded-xl border border-gray-200 p-3"><div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-2"><Toggle checked={settings.tiktok.enabled} onChange={value => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, enabled: value } }))} /><span className="font-semibold text-gray-900">♪ TikTok</span><div className="ml-auto flex flex-wrap items-center gap-2"><Toggle label="Android" checked={settings.tiktok.androidEnabled} onChange={value => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, androidEnabled: value } }))} /><Toggle label="iOS" checked={settings.tiktok.iosEnabled} onChange={value => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, iosEnabled: value } }))} /><label className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500">Hiển thị sau<input type="number" min="0" max="3600" value={settings.tiktok.delaySeconds} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, delaySeconds: Number(event.target.value) } }))} className="w-10 border-0 p-0 text-center text-xs outline-none" /> giây</label></div></div><label className="mt-2 grid gap-1 text-xs font-medium text-gray-700">Link TikTok cho Android <span className="text-[#d61f51]">*</span><input required type="url" value={settings.tiktok.androidUrl || form.secondUrl} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, url: event.target.value, androidUrl: event.target.value } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://vt.tiktok.com/..." /></label><label className="mt-2 grid gap-1 text-xs font-medium text-gray-700">Link TikTok cho iOS <span className="text-[#d61f51]">*</span><input required type="url" value={settings.tiktok.iosUrl || form.secondUrl} onChange={event => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, iosUrl: event.target.value } }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://www.tiktok.com/..." /></label><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[11px] text-gray-500">Dán link ngắn vt.tiktok.com để hệ thống xử lý tự động.</span><button type="button" disabled={busy} onClick={() => void resolveAffiliate('tiktok')} className="ml-auto rounded-md border border-[#f1b4c4] px-2.5 py-1 text-[11px] font-semibold text-[#d61f51]">Xử lý affiliate</button></div><div className="mt-2 flex items-center gap-1 text-xs"><span className="text-gray-500">iOS mode:</span><button type="button" onClick={() => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, iosMode: 'desktop' } }))} className={`rounded px-2 py-1 ${settings.tiktok.iosMode === 'desktop' ? 'bg-[#d61f51] text-white' : 'border border-gray-200 text-gray-600'}`}>Link desktop</button><button type="button" onClick={() => setSettings(current => ({ ...current, tiktok: { ...current.tiktok, iosMode: 'onelink' } }))} className={`rounded px-2 py-1 ${settings.tiktok.iosMode === 'onelink' ? 'bg-[#d61f51] text-white' : 'border border-gray-200 text-gray-600'}`}>Nhập OneLink</button></div></fieldset>
          </div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium text-gray-700">Cooldown sau khi bấm link (phút)<input type="number" min="0" max="10080" value={settings.cooldownMinutes} onChange={event => setSettings(current => ({ ...current, cooldownMinutes: Number(event.target.value) }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><span className="text-[11px] font-normal text-gray-500">Nhập 0 để popup luôn có thể hiển thị lại.</span></label><div className="grid gap-2 sm:pt-6"><label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"><span><span className="block font-medium text-gray-700">Ép mở Chrome (Android)</span><span className="text-[11px] text-gray-500">Hiện hướng dẫn khi ở Facebook.</span></span><Toggle checked={settings.forceChromeAndroid} onChange={value => setSettings(current => ({ ...current, forceChromeAndroid: value }))} /></label><label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"><span><span className="block font-medium text-gray-700">Ép mở Safari (iOS)</span><span className="text-[11px] text-gray-500">Hiện hướng dẫn khi ở Facebook.</span></span><Toggle checked={settings.forceSafariIos} onChange={value => setSettings(current => ({ ...current, forceSafariIos: value }))} /></label></div></div>
        </div>
        <div className="space-y-3"><p className="text-sm font-semibold text-gray-800">Cấu hình ảnh</p>{(['tiktok', 'shopee'] as ImageField[]).map(field => { const imageUrl = settings[field].imageUrl || (field === 'shopee' ? DEFAULT_SHOPEE_IMAGE_URL : DEFAULT_TIKTOK_IMAGE_URL); const label = field === 'shopee' ? '🛍️ Shopee popup' : '♪ TikTok popup'; const ref = field === 'shopee' ? shopeeFileRef : tiktokFileRef; return <div key={field} className="rounded-xl border border-dashed border-gray-300 p-3" onPaste={event => pasteImage(event, field)}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-800">{label}</span><button type="button" onClick={() => setSettings(current => ({ ...current, [field]: { ...current[field], imageUrl: field === 'shopee' ? DEFAULT_SHOPEE_IMAGE_URL : DEFAULT_TIKTOK_IMAGE_URL } }))} className="text-[11px] font-semibold text-[#d61f51]">Mặc định</button></div><div className="mt-2 flex aspect-[1.7] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"><img src={imageUrl} alt={`${label} preview`} className="h-full w-full object-contain" /></div><div className="mt-2 flex gap-2"><input value={settings[field].imageUrl || ''} onChange={event => setSettings(current => ({ ...current, [field]: { ...current[field], imageUrl: event.target.value || null } }))} placeholder="URL ảnh hoặc dán ảnh" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-2 text-xs" /><input ref={ref} type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadImage(file, field) }} className="hidden" /><button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Upload className="h-3.5 w-3.5" /> Upload</button></div><p className="mt-1 text-[11px] text-gray-500">Upload hoặc dán ảnh (Ctrl/Cmd + V).</p></div> })}</div>
      </div></div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:px-7"><button type="button" onClick={reset} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">Hủy</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#d61f51] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu...' : <><Check className="h-4 w-4" /> Lưu thay đổi</>}</button></div>
    </form></div>}

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Popup</th><th className="px-4 py-3">Hai lượt mở</th><th className="px-4 py-3">Bài viết</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{popups.map(popup => <tr key={popup.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-10 w-14 place-items-center rounded-lg bg-gray-950 bg-cover bg-center" style={backgroundImage(popup.settings?.shopee?.imageUrl || popup.imageUrl)}><Film className="h-4 w-4 text-white" /></div><div><p className="font-semibold text-gray-950">{popup.name}</p><p className="text-xs text-gray-500">Cooldown {popup.settings?.cooldownMinutes ?? 30} phút</p></div></div></td><td className="max-w-[300px] px-4 py-3 text-xs text-gray-600"><p className="truncate">1. {popup.settings?.shopee?.url || popup.firstUrl}</p><p className="truncate">2. {popup.settings?.tiktok?.androidUrl || popup.secondUrl}</p></td><td className="px-4 py-3 text-gray-600">{popup._count?.posts ?? 0}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${popup.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{popup.isActive ? 'Đang bật' : 'Đang tắt'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => void viewLinks(popup)} className="rounded-lg px-2 text-xs font-semibold text-[#d61f51] hover:bg-pink-50" title="Xem đầy đủ link">Link</button><button type="button" onClick={() => edit(popup)} className="rounded-lg p-2 text-[#d61f51] hover:bg-pink-50" title="Sửa"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void duplicate(popup)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Nhân bản"><Copy className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => void remove(popup)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa"><Trash2 className="h-4 w-4" /></button><Link href="/dashboard/posts" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Bài viết"><ExternalLink className="h-4 w-4" /></Link></div></td></tr>)}</tbody></table></div>{!popups.length && <p className="p-8 text-center text-sm text-gray-500">Chưa có popup phù hợp.</p>}<div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600"><span>Trang {page}/{pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div></div>
  </div>
}
