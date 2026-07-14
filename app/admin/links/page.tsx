'use client'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import { Ban, ExternalLink, Search, ShieldCheck } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminEmpty, AdminLoading, AdminPagination } from '../_components/AdminUi'

type LinkRow = {
  id: string; shortCode: string; title: string | null; originalUrl: string
  isActive: boolean; isArchived: boolean; disabledByAdmin: boolean; adminNote: string | null
  moderatedAt: string | null; createdAt: string; clickCount: number
  user: { id: string; email: string; name: string | null; status: string }
  domain: { domain: string } | null
}

export default function AdminLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ active: 0, disabled: 0 })
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<LinkRow | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (deferredSearch) params.set('search', deferredSearch)
    if (status) params.set('status', status)
    try {
      const response = await fetch(`/api/admin/links?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không tải được links')
      setLinks(data.links); setTotal(data.total); setPages(data.pages); setSummary(data.summary)
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tải được links') }
    finally { setLoading(false) }
  }, [deferredSearch, page, status])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const moderate = async () => {
    if (!selected || reason.trim().length < 3) return
    setSaving(true)
    const action = selected.disabledByAdmin ? 'enable' : 'disable'
    const response = await fetch(`/api/admin/links/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) })
    const data = await response.json(); setSaving(false)
    if (!response.ok) { setError(data.error || 'Thao tác thất bại'); return }
    setSelected(null); setReason(''); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold text-white">Quản lý links</h1><p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} link theo bộ lọc.</p></div><div className="flex gap-2"><AdminBadge value="active" label={`Active ${summary.active}`} /><AdminBadge value="disabled" label={`Admin khóa ${summary.disabled}`} /></div></div>

      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 md:grid-cols-[1fr_220px]">
        <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Shortcode, URL, email hoặc domain" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-500" /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"><option value="">Mọi trạng thái</option><option value="active">Active</option><option value="disabled">Admin khóa</option><option value="inactive">User tắt</option><option value="archived">Archived</option></select>
      </div>

      {error && <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        {loading ? <AdminLoading /> : links.length === 0 ? <AdminEmpty /> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b border-gray-800 bg-gray-950/50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Link</th><th className="px-4 py-3">Chủ sở hữu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Clicks</th><th className="px-4 py-3">Tạo lúc</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-gray-800">{links.map((link) => <tr key={link.id} className="hover:bg-gray-800/40"><td className="max-w-lg px-4 py-3"><div className="flex items-center gap-2"><span className="font-medium text-white">{link.domain?.domain || 'domain chính'}/{link.shortCode}</span><a href={link.originalUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></a></div><div className="truncate text-xs text-gray-500">{link.title || link.originalUrl}</div>{link.adminNote && <div className="mt-1 text-xs text-red-400">Admin: {link.adminNote}</div>}</td><td className="px-4 py-3"><Link href={`/admin/users/${link.user.id}`} className="text-sm text-gray-200 hover:text-red-300">{link.user.name || link.user.email}</Link><div className="text-xs text-gray-500">{link.user.email}</div></td><td className="px-4 py-3"><AdminBadge value={link.disabledByAdmin ? 'disabled' : link.isArchived ? 'cancelled' : link.isActive ? 'active' : 'pending'} label={link.disabledByAdmin ? 'Admin khóa' : link.isArchived ? 'Archived' : link.isActive ? 'Active' : 'User tắt'} /></td><td className="px-4 py-3 text-gray-300">{link.clickCount.toLocaleString()}</td><td className="px-4 py-3 text-xs text-gray-500">{new Date(link.createdAt).toLocaleString('vi-VN')}</td><td className="px-4 py-3 text-right"><button onClick={() => setSelected(link)} className={`rounded-lg border px-3 py-2 text-xs ${link.disabledByAdmin ? 'border-emerald-800 text-emerald-300' : 'border-red-900 text-red-300'}`}>{link.disabledByAdmin ? <><ShieldCheck className="mr-1 inline h-4 w-4" />Mở khóa</> : <><Ban className="mr-1 inline h-4 w-4" />Khóa</>}</button></td></tr>)}</tbody></table></div>}
        <AdminPagination page={page} pages={pages} onChange={setPage} />
      </div>

      {selected && <AdminDialog title={selected.disabledByAdmin ? 'Mở khóa link' : 'Khóa link'} onClose={() => { setSelected(null); setReason('') }}><p className="mb-3 text-sm text-gray-400">/{selected.shortCode} · {selected.user.email}</p><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do moderation" className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelected(null)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Hủy</button><button disabled={saving || reason.trim().length < 3} onClick={moderate} className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-40 ${selected.disabledByAdmin ? 'bg-emerald-600' : 'bg-red-600'}`}>Xác nhận</button></div></AdminDialog>}
    </div>
  )
}
