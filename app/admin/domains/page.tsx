'use client'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import { Ban, Globe2, Save, Search, ShieldCheck } from 'lucide-react'
import { AdminBadge, AdminDialog, AdminEmpty, AdminLoading, AdminPagination } from '../_components/AdminUi'

type DomainRow = {
  id: string
  domain: string
  verified: boolean
  disabledAt: string | null
  disabledReason: string | null
  createdAt: string
  linkCount: number
  user: { id: string; email: string; name: string | null; status: string }
}

type SystemDomainOption = {
  domain: string
  kind: 'shared' | 'primary'
}

type DefaultPostDomainPayload = {
  defaultDomain: string
  updatedAt: string | null
  updatedBy: string | null
  canWrite: boolean
  options: SystemDomainOption[]
}

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ verified: 0, disabled: 0 })
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<DomainRow | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [defaultConfig, setDefaultConfig] = useState<DefaultPostDomainPayload | null>(null)
  const [selectedDefaultDomain, setSelectedDefaultDomain] = useState('ca33newss.xyz')
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultMessage, setDefaultMessage] = useState('')

  const loadDefaultDomain = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/domains/default-post-domain', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) return
      setDefaultConfig(data)
      setSelectedDefaultDomain(data.defaultDomain || 'ca33newss.xyz')
    } catch {
      // Keep custom-domain list usable even if secondary config request fails.
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (deferredSearch) params.set('search', deferredSearch)
    if (status) params.set('status', status)
    try {
      const response = await fetch(`/api/admin/domains?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không tải được domains')
      setDomains(data.domains)
      setTotal(data.total)
      setPages(data.pages)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được domains')
    } finally {
      setLoading(false)
    }
  }, [deferredSearch, page, status])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
      void loadDefaultDomain()
    })
  }, [load, loadDefaultDomain])

  const saveDefaultPostDomain = async () => {
    if (!defaultConfig?.canWrite || savingDefault) return
    setSavingDefault(true)
    setError('')
    setDefaultMessage('')
    try {
      const response = await fetch('/api/admin/domains/default-post-domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDomain: selectedDefaultDomain }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Không thể lưu domain mặc định')
        return
      }
      setDefaultConfig(data)
      setSelectedDefaultDomain(data.defaultDomain)
      setDefaultMessage(`Đã đặt "${data.defaultDomain}" làm domain mặc định khi tạo bài mới cho toàn bộ thành viên.`)
    } catch {
      setError('Lỗi kết nối khi lưu domain mặc định')
    } finally {
      setSavingDefault(false)
    }
  }

  const moderate = async () => {
    if (!selected || reason.trim().length < 3) return
    setSaving(true)
    const response = await fetch(`/api/admin/domains/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: selected.disabledAt ? 'enable' : 'disable', reason }),
    })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) {
      setError(data.error || 'Thao tác thất bại')
      return
    }
    setSelected(null)
    setReason('')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Quản lý Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cấu hình domain mặc định cho toàn bộ thành viên và kiểm duyệt {total.toLocaleString()} custom domain.
          </p>
        </div>
        <div className="flex gap-2">
          <AdminBadge value="verified" label={`Verified ${summary.verified}`} />
          <AdminBadge value="disabled" label={`Khóa ${summary.disabled}`} />
        </div>
      </div>

      {defaultConfig && (
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold text-white">
                  Domain mặc định khi tạo bài mới (áp dụng cho toàn bộ thành viên)
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Khi bất kỳ thành viên nào bấm <strong className="text-gray-200">Tạo bài thường</strong>,{' '}
                <strong className="text-gray-200">Tạo Bọc thẳng</strong> hoặc{' '}
                <strong className="text-gray-200">Tạo bài Telegram</strong>, ô Domain sẽ tự động chọn sẵn tên miền này. Thành viên muốn dùng domain khác vẫn có thể tự đổi trong lúc tạo bài.
              </p>
            </div>
            <AdminBadge value="active" label={`Đang chọn: ${defaultConfig.defaultDomain}`} />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedDefaultDomain}
              disabled={!defaultConfig.canWrite || savingDefault}
              onChange={(event) => setSelectedDefaultDomain(event.target.value)}
              className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500 disabled:opacity-50"
            >
              {defaultConfig.options.map((option) => (
                <option key={option.domain} value={option.domain}>
                  {option.domain} {option.kind === 'primary' ? '(Domain chính)' : '(Domain hệ thống dùng chung)'}
                </option>
              ))}
            </select>
            {defaultConfig.canWrite && (
              <button
                type="button"
                disabled={savingDefault}
                onClick={() => void saveDefaultPostDomain()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {savingDefault ? 'Đang lưu...' : 'Lưu mặc định'}
              </button>
            )}
          </div>

          {defaultMessage && (
            <div className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-300">
              {defaultMessage}
            </div>
          )}
          <div className="mt-2.5 text-xs text-gray-500">
            {defaultConfig.updatedAt
              ? `Cập nhật lần cuối: ${new Date(defaultConfig.updatedAt).toLocaleString('vi-VN')}${defaultConfig.updatedBy ? ` (${defaultConfig.updatedBy})` : ''}`
              : 'Đang dùng cấu hình mặc định hệ thống (ca33newss.xyz).'}
          </div>
        </section>
      )}

      <div className="grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 md:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Domain hoặc email chủ sở hữu"
            className="w-full rounded-xl border border-gray-700 bg-gray-950 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-500"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm"
        >
          <option value="">Mọi trạng thái</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="disabled">Admin khóa</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        {loading ? (
          <AdminLoading />
        ) : domains.length === 0 ? (
          <AdminEmpty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-950/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Chủ sở hữu</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Links</th>
                  <th className="px-4 py-3">Ngày thêm</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {domains.map((domain) => (
                  <tr key={domain.id} className="hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{domain.domain}</div>
                      {domain.disabledReason && (
                        <div className="text-xs text-red-400">{domain.disabledReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${domain.user.id}`} className="text-gray-200 hover:text-red-300">
                        {domain.user.name || domain.user.email}
                      </Link>
                      <div className="text-xs text-gray-500">{domain.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge
                        value={domain.disabledAt ? 'disabled' : domain.verified ? 'verified' : 'pending'}
                        label={domain.disabledAt ? 'Admin khóa' : domain.verified ? 'Verified' : 'Chờ DNS'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-300">{domain.linkCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(domain.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(domain)}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          domain.disabledAt
                            ? 'border-emerald-800 text-emerald-300'
                            : 'border-red-900 text-red-300'
                        }`}
                      >
                        {domain.disabledAt ? (
                          <>
                            <ShieldCheck className="mr-1 inline h-4 w-4" />
                            Cho phép lại
                          </>
                        ) : (
                          <>
                            <Ban className="mr-1 inline h-4 w-4" />
                            Khóa
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination page={page} pages={pages} onChange={setPage} />
      </div>

      {selected && (
        <AdminDialog
          title={selected.disabledAt ? 'Cho phép lại domain' : 'Khóa domain'}
          onClose={() => {
            setSelected(null)
            setReason('')
          }}
        >
          <p className="mb-2 text-sm text-gray-300">{selected.domain}</p>
          {selected.disabledAt && (
            <p className="mb-3 text-xs text-amber-400">Domain phải verify DNS lại sau khi được mở khóa.</p>
          )}
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Lý do"
            className="min-h-24 w-full rounded-xl border border-gray-700 bg-gray-950 p-3 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm"
            >
              Hủy
            </button>
            <button
              disabled={saving || reason.trim().length < 3}
              onClick={moderate}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-40 ${
                selected.disabledAt ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              Xác nhận
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  )
}
