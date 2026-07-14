'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Globe2,
  Link2,
  MousePointerClick,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { AdminBadge, AdminLoading } from './_components/AdminUi'

type Stats = {
  users: { total: number; active: number; suspended: number; paid: number; expiring: number; newThisMonth: number }
  links: { total: number; active: number; disabled: number; newThisMonth: number }
  clicks: { total: number; today: number }
  revenue: { total: number; month: number; today: number }
  operations: { pendingPayments: number; unresolvedPayments: number; verifiedDomains: number; failedJobs: number }
  recentUsers: Array<{ id: string; name: string | null; email: string; plan: string; status: string; createdAt: string }>
  recentPayments: Array<{ id: string; amount: number; paidAt: string | null; user: { id: string; name: string | null; email: string } }>
}

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'text-sky-400 bg-sky-500/10',
}: {
  label: string
  value: string
  detail: string
  icon: typeof Users
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được dữ liệu admin')
        return response.json()
      })
      .then(setStats)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (!stats && !error) return <AdminLoading />
  if (!stats) return <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</div>

  const alerts = [
    { label: 'User bị khóa', value: stats.users.suspended, href: '/admin/users?status=suspended' },
    { label: 'Gói hết hạn trong 7 ngày', value: stats.users.expiring, href: '/admin/users' },
    { label: 'Payment chờ xử lý', value: stats.operations.pendingPayments, href: '/admin/transactions?status=pending' },
    { label: 'Chuyển khoản cần đối soát', value: stats.operations.unresolvedPayments, href: '/admin/transactions?tab=events' },
    { label: 'FB jobs thất bại', value: stats.operations.failedJobs, href: '/admin/system' },
  ].filter((item) => item.value > 0)

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-white">Tổng quan hệ thống</h1>
        <p className="mt-1 text-sm text-gray-500">User, nội dung, doanh thu và backlog vận hành.</p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Cần xử lý
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl bg-gray-900/70 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800">
                <span>{item.label}</span><strong className="text-amber-300">{item.value}</strong>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Người dùng" value={stats.users.total.toLocaleString()} detail={`${stats.users.active} active · ${stats.users.newThisMonth} mới tháng này`} icon={Users} tone="bg-red-500/10 text-red-400" />
        <MetricCard label="User trả phí" value={stats.users.paid.toLocaleString()} detail={`${stats.users.expiring} sắp hết hạn`} icon={CreditCard} tone="bg-purple-500/10 text-purple-400" />
        <MetricCard label="Links" value={stats.links.total.toLocaleString()} detail={`${stats.links.active} active · ${stats.links.disabled} bị admin khóa`} icon={Link2} />
        <MetricCard label="Clicks" value={stats.clicks.total.toLocaleString()} detail={`${stats.clicks.today.toLocaleString()} hôm nay`} icon={MousePointerClick} tone="bg-emerald-500/10 text-emerald-400" />
        <MetricCard label="Doanh thu tháng" value={currency.format(stats.revenue.month)} detail={`${currency.format(stats.revenue.today)} hôm nay`} icon={CreditCard} tone="bg-amber-500/10 text-amber-400" />
        <MetricCard label="Doanh thu toàn bộ" value={currency.format(stats.revenue.total)} detail="Payment completed" icon={ExternalLink} tone="bg-cyan-500/10 text-cyan-400" />
        <MetricCard label="Domains xác thực" value={stats.operations.verifiedDomains.toLocaleString()} detail="Không bị admin khóa" icon={Globe2} tone="bg-indigo-500/10 text-indigo-400" />
        <MetricCard label="Đối soát" value={stats.operations.unresolvedPayments.toLocaleString()} detail="Unmatched / thiếu tiền / lỗi" icon={ShieldAlert} tone="bg-orange-500/10 text-orange-400" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <h2 className="font-semibold text-white">Người dùng mới</h2>
            <Link href="/admin/users" className="text-xs text-red-400 hover:underline">Xem tất cả</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentUsers.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/50">
                <div><div className="text-sm font-medium text-white">{user.name || user.email}</div><div className="text-xs text-gray-500">{user.email}</div></div>
                <div className="flex gap-2"><AdminBadge value={user.plan} /><AdminBadge value={user.status} /></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <h2 className="font-semibold text-white">Thanh toán gần nhất</h2>
            <Link href="/admin/transactions" className="text-xs text-red-400 hover:underline">Xem tất cả</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between px-5 py-3">
                <div><div className="text-sm text-white">{payment.user.name || payment.user.email}</div><div className="text-xs text-gray-500">{payment.user.email}</div></div>
                <div className="font-semibold text-emerald-400">{currency.format(payment.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
