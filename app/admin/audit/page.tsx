'use client'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { AdminBadge, AdminEmpty, AdminLoading, AdminPagination } from '../_components/AdminUi'

type AuditRow = {
  id: string; adminEmail: string; adminRole: string; action: string; entityType: string; entityId: string | null
  reason: string | null; beforeData: string | null; afterData: string | null; ip: string | null; createdAt: string
}

function prettyJson(value: string | null) {
  if (!value) return '—'
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditRow[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [entityType, setEntityType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (deferredSearch) params.set('search', deferredSearch)
    if (entityType) params.set('entityType', entityType)
    try {
      const response = await fetch(`/api/admin/audit?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không tải được audit')
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tải được audit') }
    finally { setLoading(false) }
  }, [deferredSearch, entityType, page])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-white">Audit logs</h1><p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} thao tác quản trị bất biến.</p></div><div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 md:grid-cols-[1fr_220px]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Admin, action, entity ID hoặc lý do" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-9 pr-3 text-sm" /></label><select value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"><option value="">Mọi đối tượng</option><option value="user">User</option><option value="link">Link</option><option value="domain">Domain</option><option value="payment">Payment</option><option value="payment_event">Payment event</option><option value="system">System</option><option value="phim_link">Phim link</option></select></div>{error && <div className="text-red-300">{error}</div>}<div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">{loading ? <AdminLoading /> : items.length === 0 ? <AdminEmpty /> : <div className="divide-y divide-gray-800">{items.map((item) => <article key={item.id} className="p-4"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-white">{item.action}</span><AdminBadge value="active" label={item.entityType} /><span className="text-xs text-gray-500">{item.entityId}</span></div><div className="mt-1 text-xs text-gray-500">{item.adminEmail} · {item.adminRole} · {item.ip || 'no-ip'} · {new Date(item.createdAt).toLocaleString('vi-VN')}</div>{item.reason && <div className="mt-2 text-sm text-gray-300">Lý do: {item.reason}</div>}</div><details className="lg:w-1/2"><summary className="cursor-pointer text-right text-xs text-red-400">Xem before/after</summary><div className="mt-2 grid gap-2 md:grid-cols-2"><pre className="max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] text-gray-400">{prettyJson(item.beforeData)}</pre><pre className="max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] text-gray-400">{prettyJson(item.afterData)}</pre></div></details></div></article>)}</div>}<AdminPagination page={page} pages={pages} onChange={setPage} /></div></div>
}
