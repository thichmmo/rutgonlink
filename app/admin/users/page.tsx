'use client'

import { Suspense, useCallback, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, UserRoundCog } from 'lucide-react'
import { AdminBadge, AdminEmpty, AdminLoading, AdminPagination } from '../_components/AdminUi'

type UserRow = {
  id: string
  numericId: number
  name: string | null
  email: string
  loginType: 'password' | 'google'
  status: string
  adminRole: string | null
  plan: string
  planExpiresAt: string | null
  lastLoginAt: string | null
  createdAt: string
  linkCount: number
  domainCount: number
  paymentCount: number
  clickCount: number
}

type ResponseData = {
  users: UserRow[]
  total: number
  page: number
  pages: number
  summary: { statuses: Record<string, number>; plans: Record<string, number> }
}

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra', ultra_plus: 'Ultra+' }

function UsersContent() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<UserRow[]>([])
  const [summary, setSummary] = useState<ResponseData['summary']>({ statuses: {}, plans: {} })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [loginType, setLoginType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (deferredSearch) params.set('search', deferredSearch)
    if (plan) params.set('plan', plan)
    if (status) params.set('status', status)
    if (loginType) params.set('loginType', loginType)

    try {
      const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không tải được user')
      setUsers(data.users)
      setTotal(data.total)
      setPages(data.pages)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được user')
    } finally {
      setLoading(false)
    }
  }, [deferredSearch, loginType, page, plan, status])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Người dùng</h1>
          <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} tài khoản theo bộ lọc hiện tại.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <AdminBadge value="active" label={`Active ${summary.statuses.active || 0}`} />
          <AdminBadge value="suspended" label={`Khóa ${summary.statuses.suspended || 0}`} />
          <AdminBadge value="deleted" label={`Đã xóa ${summary.statuses.deleted || 0}`} />
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 md:grid-cols-4">
        <label className="relative md:col-span-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Email, tên hoặc ID" className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-red-500" />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white">
          <option value="">Mọi trạng thái</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
        </select>
        <select value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white">
          <option value="">Mọi gói</option>{Object.entries(PLAN_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={loginType} onChange={(event) => { setLoginType(event.target.value); setPage(1) }} className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white">
          <option value="">Mọi đăng nhập</option><option value="google">Google</option><option value="password">Mật khẩu</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        {loading ? <AdminLoading /> : error ? (
          <div className="p-5 text-red-300">{error}</div>
        ) : users.length === 0 ? <AdminEmpty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-950/50 text-xs uppercase text-gray-500">
                <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Gói</th><th className="px-4 py-3">Hoạt động</th><th className="px-4 py-3">Đăng nhập cuối</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/40">
                    <td className="px-4 py-3"><div className="font-medium text-white">#{user.numericId} · {user.name || 'Chưa đặt tên'}</div><div className="text-xs text-gray-500">{user.email}</div><div className="mt-1 text-[11px] text-gray-600">{user.loginType}{user.adminRole ? ` · ${user.adminRole}` : ''}</div></td>
                    <td className="px-4 py-3"><AdminBadge value={user.status} /></td>
                    <td className="px-4 py-3"><AdminBadge value={user.plan} label={PLAN_LABEL[user.plan] || user.plan} />{user.planExpiresAt && <div className="mt-1 text-xs text-gray-500">đến {new Date(user.planExpiresAt).toLocaleDateString('vi-VN')}</div>}</td>
                    <td className="px-4 py-3 text-xs text-gray-400"><div>{user.linkCount} links · {user.clickCount.toLocaleString()} clicks</div><div>{user.domainCount} domains · {user.paymentCount} payments</div></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/users/${user.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"><UserRoundCog className="h-4 w-4" /> Chi tiết</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination page={page} pages={pages} onChange={setPage} />
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return <Suspense fallback={<AdminLoading />}><UsersContent /></Suspense>
}
