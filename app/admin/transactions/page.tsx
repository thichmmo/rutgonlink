'use client'

import { Suspense, useCallback, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Search, XCircle } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminEmpty, AdminLoading, AdminPagination } from '../_components/AdminUi'

type Payment = { id: string; amount: number; content: string; transactionID: string | null; status: string; paidAt: string | null; createdAt: string; user: { id: string; name: string | null; email: string }; subscription: { plan: string; period: string; status: string } | null }
type Subscription = { id: string; plan: string; period: string; status: string; startDate: string | null; endDate: string | null; createdAt: string; user: { id: string; name: string | null; email: string } }
type PaymentEvent = { id: string; externalId: string | null; transferAmount: number; content: string; status: string; message: string | null; createdAt: string; payment: { id: string; amount: number; status: string; user: { id: string; email: string } } | null }
type Selected = { type: 'payment'; item: Payment; action: 'complete' | 'cancel' } | { type: 'event'; item: PaymentEvent } | null
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function TransactionsContent() {
  const query = useSearchParams()
  const [tab, setTab] = useState(query.get('tab') || 'payments')
  const [items, setItems] = useState<Array<Payment | Subscription | PaymentEvent>>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [pending, setPending] = useState(0)
  const [unresolved, setUnresolved] = useState(0)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState(query.get('status') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Selected>(null)
  const [reason, setReason] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ tab, page: String(page) })
    if (status) params.set('status', status)
    if (deferredSearch) params.set('search', deferredSearch)
    try {
      const response = await fetch(`/api/admin/transactions?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không tải được dữ liệu')
      setItems(data.items); setTotal(data.total); setPages(data.pages); setTotalRevenue(data.totalRevenue || 0); setPending(data.pending || 0); setUnresolved(data.unresolved || 0)
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tải được dữ liệu') }
    finally { setLoading(false) }
  }, [deferredSearch, page, status, tab])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const runAction = async () => {
    if (!selected || reason.trim().length < 3) return
    setSaving(true); setError('')
    const url = selected.type === 'payment' ? `/api/admin/transactions/${selected.item.id}` : `/api/admin/payment-events/${selected.item.id}`
    const body = selected.type === 'payment' ? { action: selected.action, reason, transactionId: transactionId || undefined } : { paymentId, reason }
    const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json(); setSaving(false)
    if (!response.ok) { setError(data.error || 'Thao tác thất bại'); return }
    setSelected(null); setReason(''); setTransactionId(''); setPaymentId(''); load()
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Thanh toán & subscription</h1><p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} bản ghi · đối soát và quản lý vòng đời gói dịch vụ.</p></div>
      <div className="grid gap-4 sm:grid-cols-3"><Summary label="Doanh thu hoàn tất" value={currency.format(totalRevenue)} /><Summary label="Payment pending" value={String(pending)} /><Summary label="Sự kiện cần đối soát" value={String(unresolved)} danger={unresolved > 0} /></div>
      <div className="flex flex-wrap gap-2">{[['payments','Payments'],['subscriptions','Subscriptions'],['events','SePay Events']].map(([value,label]) => <button key={value} onClick={() => { setTab(value); setStatus(''); setPage(1) }} className={`rounded-lg px-4 py-2 text-sm ${tab === value ? 'bg-red-600 text-white' : 'border border-gray-700 text-gray-400 hover:bg-gray-800'}`}>{label}</button>)}</div>
      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 md:grid-cols-[1fr_220px]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Email, mã chuyển khoản hoặc nội dung" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-9 pr-3 text-sm" /></label><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"><option value="">Mọi trạng thái</option>{tab === 'events' ? <><option value="unmatched">Unmatched</option><option value="amount_mismatch">Thiếu tiền</option><option value="error">Error</option><option value="matched">Matched</option><option value="manually_matched">Manual</option></> : <><option value="pending">Pending</option><option value="completed">Completed</option><option value="active">Active</option><option value="cancelled">Cancelled</option></>}</select></div>
      {error && <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">{loading ? <AdminLoading /> : items.length === 0 ? <AdminEmpty /> : tab === 'payments' ? <PaymentsTable items={items as Payment[]} onSelect={setSelected} /> : tab === 'subscriptions' ? <SubscriptionsTable items={items as Subscription[]} /> : <EventsTable items={items as PaymentEvent[]} onSelect={setSelected} />}<AdminPagination page={page} pages={pages} onChange={setPage} /></div>
      {selected && <AdminDialog title={selected.type === 'event' ? 'Đối soát chuyển khoản' : selected.action === 'complete' ? 'Hoàn tất payment' : 'Hủy payment'} onClose={() => setSelected(null)}><p className="mb-3 text-sm text-gray-400">Mọi thao tác được lưu audit log.</p>{selected.type === 'event' && <input value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Payment ID cần ghép" className="mb-3 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm" />}{selected.type === 'payment' && selected.action === 'complete' && <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="Transaction ID (không bắt buộc)" className="mb-3 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm" />}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do" className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelected(null)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Hủy</button><button disabled={saving || reason.trim().length < 3 || (selected.type === 'event' && !paymentId)} onClick={runAction} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40">Xác nhận</button></div></AdminDialog>}
    </div>
  )
}

function Summary({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-xl border border-gray-800 bg-gray-900 p-4"><div className="text-xs text-gray-500">{label}</div><div className={`mt-1 text-xl font-bold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</div></div> }
function PaymentsTable({ items, onSelect }: { items: Payment[]; onSelect: (value: Selected) => void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Gói</th><th className="px-4 py-3">Số tiền</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-gray-800">{items.map((item) => <tr key={item.id}><td className="px-4 py-3"><Link href={`/admin/users/${item.user.id}`} className="text-white hover:text-red-300">{item.user.name || item.user.email}</Link><div className="text-xs text-gray-500">{item.user.email}</div></td><td className="px-4 py-3">{item.subscription ? `${item.subscription.plan} · ${item.subscription.period}` : '—'}</td><td className="px-4 py-3 font-medium text-white">{currency.format(item.amount)}</td><td className="px-4 py-3"><div>{item.content}</div><div className="text-xs text-gray-500">{item.transactionID || item.id}</div></td><td className="px-4 py-3"><AdminBadge value={item.status} /></td><td className="px-4 py-3 text-right">{item.status === 'pending' && <div className="flex justify-end gap-2"><button onClick={() => onSelect({ type: 'payment', item, action: 'complete' })} className="text-emerald-400"><CheckCircle2 className="h-5 w-5" /></button><button onClick={() => onSelect({ type: 'payment', item, action: 'cancel' })} className="text-red-400"><XCircle className="h-5 w-5" /></button></div>}</td></tr>)}</tbody></table></div> }
function SubscriptionsTable({ items }: { items: Subscription[] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Gói</th><th className="px-4 py-3">Chu kỳ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thời hạn</th></tr></thead><tbody className="divide-y divide-gray-800">{items.map((item) => <tr key={item.id}><td className="px-4 py-3"><Link href={`/admin/users/${item.user.id}`} className="text-white hover:text-red-300">{item.user.name || item.user.email}</Link></td><td className="px-4 py-3"><AdminBadge value={item.plan} /></td><td className="px-4 py-3">{item.period}</td><td className="px-4 py-3"><AdminBadge value={item.status} /></td><td className="px-4 py-3 text-xs text-gray-500">{item.endDate ? new Date(item.endDate).toLocaleDateString('vi-VN') : 'Trọn đời / chưa kích hoạt'}</td></tr>)}</tbody></table></div> }
function EventsTable({ items, onSelect }: { items: PaymentEvent[]; onSelect: (value: Selected) => void }) { const unresolvedStatuses = new Set(['unmatched','amount_mismatch','error']); return <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">External ID</th><th className="px-4 py-3">Số tiền</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-gray-800">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 text-xs text-gray-400">{item.externalId || item.id}</td><td className="px-4 py-3 font-medium text-white">{currency.format(item.transferAmount)}</td><td className="max-w-sm px-4 py-3"><div className="truncate">{item.content}</div><div className="text-xs text-gray-500">{item.message}</div></td><td className="px-4 py-3 text-xs text-gray-400">{item.payment ? <Link href={`/admin/users/${item.payment.user.id}`} className="hover:text-white">{item.payment.id}<br/>{item.payment.user.email}</Link> : 'Chưa ghép'}</td><td className="px-4 py-3"><AdminBadge value={item.status} /></td><td className="px-4 py-3 text-right">{unresolvedStatuses.has(item.status) && <button onClick={() => onSelect({ type: 'event', item })} className="rounded-lg border border-amber-800 px-3 py-2 text-xs text-amber-300">Đối soát</button>}</td></tr>)}</tbody></table></div> }

export default function AdminTransactionsPage() { return <Suspense fallback={<AdminLoading />}><TransactionsContent /></Suspense> }
