'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminLoading } from '../_components/AdminUi'

type SystemData = {
  database: { ok: boolean; latencyMs: number; message: string }
  app: { hostname: string; nodeEnv: string; googleOAuth: boolean; googleCallback: string; driveCallback: string; cronSecret: boolean; logSecret: boolean; encryptionKey: boolean; sepayWebhookSecret: boolean; facebookToken: boolean }
  jobs: { failed: number; pending: number }
  payments: { unresolved: number }
  lastCron: EventRow | null
  lastWebhook: EventRow | null
  recentErrors: EventRow[]
  currentAdmin: { email: string; role: string }
}
type EventRow = { id: string; type: string; source: string; status: string; message: string | null; createdAt: string }

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [error, setError] = useState('')
  const [cleanup, setCleanup] = useState(false)
  const [retentionDays, setRetentionDays] = useState(30)
  const [reason, setReason] = useState('Dọn log theo chính sách lưu trữ')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const response = await fetch('/api/admin/system', { cache: 'no-store' })
    const json = await response.json()
    if (!response.ok) { setError(json.error || 'Không tải được system health'); return }
    setData(json)
  }, [])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const runCleanup = async () => {
    setSaving(true)
    const response = await fetch('/api/admin/system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cleanup-logs', retentionDays, reason }) })
    const json = await response.json(); setSaving(false)
    if (!response.ok) { setError(json.error || 'Cleanup thất bại'); return }
    setCleanup(false); load()
  }

  if (!data && !error) return <AdminLoading />
  if (!data) return <div className="text-red-300">{error}</div>
  const configs = [['Google OAuth', data.app.googleOAuth], ['Cron secret', data.app.cronSecret], ['SePay webhook secret', data.app.sepayWebhookSecret], ['Log secret', data.app.logSecret], ['Encryption key', data.app.encryptionKey], ['Facebook token env', data.app.facebookToken]] as const

  return <div className="space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold text-white">System health</h1><p className="mt-1 text-sm text-gray-500">{data.app.hostname} · {data.app.nodeEnv} · admin {data.currentAdmin.role}</p></div><div className="flex gap-2"><button onClick={load} className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300"><RefreshCw className="mr-1 inline h-4 w-4" />Refresh</button><button onClick={() => setCleanup(true)} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300"><Trash2 className="mr-1 inline h-4 w-4" />Dọn logs</button></div></div>{error && <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-red-300">{error}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><HealthCard title="Database" ok={data.database.ok} detail={`${data.database.latencyMs}ms · ${data.database.message}`} icon={Database} /><HealthCard title="Cron gần nhất" ok={data.lastCron?.status === 'ok'} detail={data.lastCron ? new Date(data.lastCron.createdAt).toLocaleString('vi-VN') : 'Chưa có heartbeat'} /><HealthCard title="SePay webhook" ok={data.lastWebhook?.status === 'ok'} detail={data.lastWebhook ? `${data.lastWebhook.message || data.lastWebhook.status} · ${new Date(data.lastWebhook.createdAt).toLocaleString('vi-VN')}` : 'Chưa có event'} /><HealthCard title="Operational backlog" ok={data.jobs.failed === 0 && data.payments.unresolved === 0} detail={`${data.jobs.pending} jobs chờ · ${data.jobs.failed} failed · ${data.payments.unresolved} đối soát`} /></div><section className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><h2 className="mb-4 font-semibold text-white">Cấu hình tích hợp</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{configs.map(([label, ok]) => <div key={label} className="flex items-center justify-between rounded-xl bg-gray-950 px-4 py-3 text-sm"><span className="text-gray-300">{label}</span>{ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}</div>)}</div><div className="mt-4 space-y-2 rounded-xl bg-gray-950 p-4 font-mono text-xs text-gray-500"><div>{data.app.googleCallback}</div><div>{data.app.driveCallback}</div></div></section><section className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold text-white"><AlertTriangle className="h-4 w-4 text-amber-400" />Cảnh báo gần đây</h2>{data.recentErrors.length === 0 ? <div className="text-sm text-gray-500">Không có cảnh báo.</div> : <div className="divide-y divide-gray-800">{data.recentErrors.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 py-3"><div><div className="text-sm text-gray-200">{event.message || event.type}</div><div className="text-xs text-gray-500">{event.source}</div></div><div className="text-right"><AdminBadge value={event.status} /><div className="mt-1 text-xs text-gray-600">{new Date(event.createdAt).toLocaleString('vi-VN')}</div></div></div>)}</div>}</section>{cleanup && <AdminDialog title="Dọn request/system logs" onClose={() => setCleanup(false)}><p className="mb-3 text-sm text-amber-300">Audit logs và payment events không bị xóa bởi thao tác này.</p><label className="block text-sm text-gray-400">Giữ lại số ngày<input type="number" min={7} max={365} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5" /></label><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setCleanup(false)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Hủy</button><button disabled={saving || reason.length < 3} onClick={runCleanup} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40">Dọn dữ liệu cũ</button></div></AdminDialog>}</div>
}

function HealthCard({ title, ok, detail, icon: Icon }: { title: string; ok: boolean; detail: string; icon?: typeof Database }) { return <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-500">{title}</span>{Icon ? <Icon className={`h-5 w-5 ${ok ? 'text-emerald-400' : 'text-red-400'}`} /> : ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}</div><div className={`mt-3 text-lg font-semibold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>{ok ? 'Ổn định' : 'Cần kiểm tra'}</div><div className="mt-1 text-xs text-gray-500">{detail}</div></div> }
