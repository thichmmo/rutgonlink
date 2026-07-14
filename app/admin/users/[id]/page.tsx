'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Ban, KeyRound, RefreshCw, Shield, Trash2, UserCheck } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminEmpty, AdminLoading } from '../../_components/AdminUi'

type UserDetail = {
  user: {
      id: string; numericId: number; email: string; name: string | null; status: string; adminRole: string | null
    plan: string; planExpiresAt: string | null; lastLoginAt: string | null; createdAt: string
    suspendedAt: string | null; suspensionReason: string | null; deletedAt: string | null
    googleDriveEmail: string | null; hasApiKey: boolean
    _count: { links: number; domains: number; notes: number; ownedWorkspaces: number; payments: number }
  }
  links: Array<{ id: string; shortCode: string; title: string | null; originalUrl: string; isActive: boolean; disabledByAdmin: boolean; createdAt: string; _count: { clicks: number } }>
  domains: Array<{ id: string; domain: string; verified: boolean; disabledAt: string | null; createdAt: string }>
  payments: Array<{ id: string; amount: number; content: string; status: string; paidAt: string | null; createdAt: string }>
  subscriptions: Array<{ id: string; plan: string; period: string; status: string; startDate: string | null; endDate: string | null }>
  workspaces: Array<{ id: string; name: string; slug: string; createdAt: string }>
  recentActivity: Array<{ id: number; method: string; path: string; ip: string | null; country: string | null; createdAt: string }>
  currentAdmin: { role: string; permissions: string[] }
}

type PendingAction = { action: string; label: string; danger?: boolean } | null
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<UserDetail | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingAction>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState('pro')
  const [period, setPeriod] = useState('1m')
  const [role, setRole] = useState('')

  const load = useCallback(async () => {
    setError('')
    const response = await fetch(`/api/admin/users/${params.id}`, { cache: 'no-store' })
    const json = await response.json()
    if (!response.ok) { setError(json.error || 'Không tải được user'); return }
    setData(json)
    setRole(json.user.adminRole || '')
  }, [params.id])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const execute = async (action: string, extra: Record<string, unknown> = {}) => {
    if (reason.trim().length < 3) { setError('Lý do phải có ít nhất 3 ký tự'); return }
    setSaving(true)
    setError('')
    const response = await fetch(`/api/admin/users/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason, ...extra }),
    })
    const json = await response.json()
    setSaving(false)
    if (!response.ok) { setError(json.error || 'Thao tác thất bại'); return }
    setPending(null); setReason(''); await load()
  }

  if (!data && !error) return <AdminLoading />
  if (!data) return <div className="text-red-300">{error}</div>
  const { user } = data
  const canWrite = data.currentAdmin.permissions.includes('users.write')
  const canManagePlan = canWrite || data.currentAdmin.permissions.includes('billing.write')
  const canManageRoles = data.currentAdmin.permissions.includes('users.roles')

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white"><ArrowLeft className="h-4 w-4" /> Người dùng</Link>
          <h1 className="text-2xl font-bold text-white">{user.name || 'Chưa đặt tên'}</h1>
            <p className="text-sm text-gray-500">{user.email} · ID #{user.numericId}</p>
          <div className="mt-3 flex flex-wrap gap-2"><AdminBadge value={user.status} /><AdminBadge value={user.plan} />{user.adminRole && <AdminBadge value="active" label={`admin: ${user.adminRole}`} />}</div>
        </div>
        {canWrite && <div className="flex flex-wrap gap-2">
          {user.status === 'active' ? <button onClick={() => setPending({ action: 'suspend', label: 'Khóa tài khoản', danger: true })} className="rounded-lg border border-orange-700 px-3 py-2 text-sm text-orange-300 hover:bg-orange-950"><Ban className="mr-1 inline h-4 w-4" />Khóa</button> : <button onClick={() => setPending({ action: user.status === 'deleted' ? 'restore' : 'activate', label: 'Khôi phục tài khoản' })} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950"><UserCheck className="mr-1 inline h-4 w-4" />Khôi phục</button>}
          <button onClick={() => setPending({ action: 'revoke-sessions', label: 'Thu hồi toàn bộ phiên', danger: true })} className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"><RefreshCw className="mr-1 inline h-4 w-4" />Thu hồi phiên</button>
          {user.hasApiKey && <button onClick={() => setPending({ action: 'revoke-api-key', label: 'Thu hồi API key', danger: true })} className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"><KeyRound className="mr-1 inline h-4 w-4" />Thu hồi API key</button>}
          {user.status !== 'deleted' && <button onClick={() => setPending({ action: 'soft-delete', label: 'Xóa mềm tài khoản', danger: true })} className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-950"><Trash2 className="mr-1 inline h-4 w-4" />Xóa mềm</button>}
        </div>}
      </div>

      {error && <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries({ Links: user._count.links, Domains: user._count.domains, Notes: user._count.notes, Workspaces: user._count.ownedWorkspaces, Payments: user._count.payments }).map(([label, value]) => <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-4"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-xl font-bold text-white">{value}</div></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Tài khoản</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Đăng ký</dt><dd className="text-gray-200">{new Date(user.createdAt).toLocaleString('vi-VN')}</dd></div>
            <div><dt className="text-gray-500">Đăng nhập cuối</dt><dd className="text-gray-200">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}</dd></div>
            <div><dt className="text-gray-500">Hết hạn gói</dt><dd className="text-gray-200">{user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString('vi-VN') : 'Không'}</dd></div>
            <div><dt className="text-gray-500">Google Drive</dt><dd className="text-gray-200">{user.googleDriveEmail || 'Chưa kết nối'}</dd></div>
          </dl>
          {user.suspensionReason && <div className="mt-4 rounded-xl bg-orange-950/30 p-3 text-sm text-orange-300">Lý do: {user.suspensionReason}</div>}
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Quản lý gói</h2>
          {!canManagePlan ? <p className="text-sm text-gray-500">Role hiện tại chỉ có quyền xem.</p> : <>
          <div className="grid gap-3 sm:grid-cols-2"><select value={plan} onChange={(event) => setPlan(event.target.value)} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"><option value="free">Free</option><option value="pro">Pro</option><option value="ultra">Ultra</option><option value="ultra_plus">Ultra+</option></select><select value={period} onChange={(event) => setPeriod(event.target.value)} disabled={plan === 'free'} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm disabled:opacity-40"><option value="1m">1 tháng</option><option value="6m">6 tháng</option><option value="1y">1 năm</option><option value="lifetime">Trọn đời</option></select></div>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do thay đổi gói" className="mt-3 min-h-20 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm" />
          <button disabled={saving} onClick={() => execute('update-plan', { plan, period })} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">Cập nhật gói</button>
          </>}
        </section>
      </div>

      {canManageRoles && <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold text-white"><Shield className="h-4 w-4" />Phân quyền admin</h2><div className="flex flex-col gap-3 sm:flex-row"><select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"><option value="">Không phải admin</option><option value="support">Support</option><option value="finance">Finance</option><option value="ops">Operations</option><option value="viewer">Viewer</option></select><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do phân quyền" className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm" /><button onClick={() => execute('set-admin-role', { adminRole: role || null })} className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300">Lưu role</button></div></section>}

      <div className="grid gap-5 xl:grid-cols-2">
        <DataSection title="Links gần đây" empty="User chưa có link">{data.links.map((link) => <div key={link.id} className="flex items-center justify-between border-b border-gray-800 py-3 last:border-0"><div className="min-w-0"><div className="truncate text-sm text-white">/{link.shortCode} · {link.title || 'Không tiêu đề'}</div><div className="max-w-md truncate text-xs text-gray-500">{link.originalUrl}</div></div><div className="ml-3 text-right text-xs text-gray-500">{link._count.clicks} clicks<br/><AdminBadge value={link.disabledByAdmin ? 'disabled' : link.isActive ? 'active' : 'cancelled'} /></div></div>)}</DataSection>
        <DataSection title="Domains" empty="User chưa có domain">{data.domains.map((domain) => <div key={domain.id} className="flex items-center justify-between border-b border-gray-800 py-3 last:border-0"><span className="text-sm text-white">{domain.domain}</span><AdminBadge value={domain.disabledAt ? 'disabled' : domain.verified ? 'verified' : 'pending'} /></div>)}</DataSection>
        <DataSection title="Payment gần đây" empty="Chưa có payment">{data.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between border-b border-gray-800 py-3 last:border-0"><div><div className="text-sm text-white">{currency.format(payment.amount)}</div><div className="text-xs text-gray-500">{payment.content}</div></div><AdminBadge value={payment.status} /></div>)}</DataSection>
        <DataSection title="Hoạt động gần đây" empty="Chưa có request log">{data.recentActivity.map((item) => <div key={item.id} className="border-b border-gray-800 py-2 text-xs last:border-0"><span className="text-gray-300">{item.method} {item.path}</span><span className="float-right text-gray-600">{new Date(item.createdAt).toLocaleString('vi-VN')}</span></div>)}</DataSection>
      </div>

      {pending && <AdminDialog title={pending.label} onClose={() => { setPending(null); setReason('') }}><p className="mb-3 text-sm text-gray-400">Thao tác được ghi vào audit log. Hãy nhập lý do rõ ràng.</p><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm" placeholder="Lý do" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setPending(null)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Hủy</button><button disabled={saving || reason.trim().length < 3} onClick={() => execute(pending.action)} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${pending.danger ? 'bg-red-600' : 'bg-emerald-600'}`}>Xác nhận</button></div></AdminDialog>}
    </div>
  )
}

function DataSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><h2 className="mb-2 font-semibold text-white">{title}</h2>{hasChildren ? children : <AdminEmpty>{empty}</AdminEmpty>}</section>
}
