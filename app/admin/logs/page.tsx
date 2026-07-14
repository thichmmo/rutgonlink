'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const DAYS_OPTIONS = [1, 7, 14, 30]
const SITE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'rutgon', label: 'rutgonlink.site' },
  { value: 'tienich', label: 'rutgonlink.site' },
]

interface Log {
  id: number
  site: string
  method: string
  path: string
  ip: string
  country: string
  device: string
  browser: string
  os: string
  userEmail: string | null
  createdAt: string
}

interface Stats {
  topIPs: { ip: string; count: number; emails: string[] }[]
  topCountries: { country: string; count: number }[]
  topPaths: { path: string; count: number }[]
  bySite: { site: string; count: number }[]
  byDevice: { device: string; count: number }[]
  byBrowser: { browser: string; count: number }[]
  byHour: { hour: number; count: number }[]
}

export default function AdminLogsPage() {
  const [days, setDays] = useState(7)
  const [site, setSite] = useState('all')
  const [page, setPage] = useState(1)

  // Column filters (applied)
  const [fIp, setFIp] = useState('')
  const [fCountry, setFCountry] = useState('')
  const [fPath, setFPath] = useState('')
  const [fDevice, setFDevice] = useState('')
  const [fBrowser, setFBrowser] = useState('')
  const [fUser, setFUser] = useState('')

  // Column filter inputs (typing state)
  const [fIpInput, setFIpInput] = useState('')
  const [fPathInput, setFPathInput] = useState('')
  const [fUserInput, setFUserInput] = useState('')

  const [logs, setLogs] = useState<Log[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      days: String(days),
      site,
      page: String(page),
      ...(fIp ? { ip: fIp } : {}),
      ...(fCountry ? { country: fCountry } : {}),
      ...(fPath ? { path: fPath } : {}),
      ...(fDevice ? { device: fDevice } : {}),
      ...(fBrowser ? { browser: fBrowser } : {}),
      ...(fUser ? { userEmail: fUser } : {}),
    })
    const res = await fetch(`/api/admin/logs?${params}`)
    const data = await res.json()
    setLogs(data.logs)
    setStats(data.stats)
    setTotal(data.total)
    setPages(data.pages)
    setLoading(false)
  }, [days, site, page, fIp, fCountry, fPath, fDevice, fBrowser, fUser])

  useEffect(() => { fetchData() }, [fetchData])

  const hasColumnFilters = fIp || fCountry || fPath || fDevice || fBrowser || fUser

  function clearAllFilters() {
    setFIp(''); setFIpInput('')
    setFCountry('')
    setFPath(''); setFPathInput('')
    setFDevice('')
    setFBrowser('')
    setFUser(''); setFUserInput('')
    setPage(1)
  }

  function applyIp() { setFIp(fIpInput); setPage(1) }
  function applyPath() { setFPath(fPathInput); setPage(1) }
  function applyUser() { setFUser(fUserInput); setPage(1) }

  const colInputClass = "w-full bg-gray-950 text-gray-300 text-xs px-1.5 py-1 rounded border border-gray-700 placeholder-gray-600 focus:outline-none focus:border-blue-500"
  const colSelectClass = "w-full bg-gray-950 text-gray-300 text-xs px-1.5 py-1 rounded border border-gray-700 focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white mr-auto">Request Logs</h1>

        <div className="flex gap-2">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setDays(d); setPage(1) }}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                days === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {d === 1 ? '24h' : `${d} ngày`}
            </button>
          ))}
        </div>

        <select
          value={site}
          onChange={(e) => { setSite(e.target.value); setPage(1) }}
          className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-gray-700"
        >
          {SITE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button
          onClick={fetchData}
          className="px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white text-xs rounded-lg border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng requests', value: total.toLocaleString() },
          { label: 'Unique IPs', value: stats ? new Set(stats.topIPs.map((x) => x.ip)).size : '-' },
          { label: 'rutgonlink.site', value: stats?.bySite.find((s) => s.site === 'rutgon')?.count.toLocaleString() ?? 0 },
          { label: 'rutgonlink.site', value: stats?.bySite.find((s) => s.site === 'tienich')?.count.toLocaleString() ?? 0 },
        ].map((item) => (
          <div key={item.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Requests theo giờ (24h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats?.byHour ?? []}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(h) => `${h}h`} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelFormatter={(h) => `${h}:00`}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Thiết bị & Trình duyệt</h3>
          <div className="grid grid-cols-2 gap-2">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats?.byDevice ?? []} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={60} label={({ name }) => name as string}>
                  {(stats?.byDevice ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 self-center">
              {(stats?.byBrowser ?? []).slice(0, 5).map((b) => (
                <div key={b.browser} className="flex justify-between text-xs">
                  <span className="text-gray-400">{b.browser}</span>
                  <span className="text-white font-medium">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top IPs */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Top IPs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">IP</th>
                <th className="text-right py-2">Requests</th>
                <th className="text-left py-2 pl-4">Accounts (rutgon)</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topIPs ?? []).map((row) => (
                <tr key={row.ip} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 font-mono text-blue-400">
                    <button
                      onClick={() => { setFIpInput(row.ip); setFIp(row.ip); setPage(1) }}
                      className="hover:underline"
                    >
                      {row.ip}
                    </button>
                  </td>
                  <td className="py-2 text-right text-white font-medium">{row.count}</td>
                  <td className="py-2 pl-4">
                    {row.emails.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.emails.map((e) => (
                          <button
                            key={e}
                            onClick={() => { setFUserInput(e); setFUser(e); setPage(1) }}
                            className="px-2 py-0.5 bg-sky-900/40 text-sky-400 rounded text-xs hover:bg-sky-900/70"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-600">Chưa đăng nhập</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top countries & paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Top quốc gia</h3>
          <div className="space-y-2">
            {(stats?.topCountries ?? []).map((c) => {
              const max = stats?.topCountries[0]?.count || 1
              return (
                <div key={c.country} className="flex items-center gap-2">
                  <button
                    onClick={() => { setFCountry(c.country || ''); setPage(1) }}
                    className="text-gray-400 text-xs w-8 hover:text-blue-400 text-left"
                  >
                    {c.country || '??'}
                  </button>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <span className="text-white text-xs w-12 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Top paths</h3>
          <div className="space-y-1">
            {(stats?.topPaths ?? []).map((p) => (
              <div key={p.path} className="flex justify-between text-xs">
                <button
                  onClick={() => { setFPathInput(p.path); setFPath(p.path); setPage(1) }}
                  className="text-gray-400 font-mono truncate max-w-[220px] hover:text-blue-400 text-left"
                >
                  {p.path}
                </button>
                <span className="text-white font-medium ml-2">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">
            Recent Requests{' '}
            <span className="text-gray-500 font-normal">({total.toLocaleString()} total)</span>
          </h3>
          {hasColumnFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-900/20 border border-red-900/40"
            >
              ✕ Xóa tất cả bộ lọc
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-600 text-sm">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                {/* Column headers */}
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2">Thời gian</th>
                  <th className="text-left px-2 py-2">Site</th>
                  <th className="text-left px-2 py-2">IP</th>
                  <th className="text-left px-2 py-2">Country</th>
                  <th className="text-left px-2 py-2">Path</th>
                  <th className="text-left px-2 py-2">Device</th>
                  <th className="text-left px-2 py-2">Browser</th>
                  <th className="text-left px-2 py-2">User</th>
                </tr>
                {/* Filter row */}
                <tr className="border-b border-gray-700 bg-gray-800/60">
                  <th className="px-4 py-1.5 text-gray-600 text-xs font-normal italic">—</th>

                  {/* Site filter */}
                  <th className="px-2 py-1.5">
                    <select
                      value={fDevice === '' && fBrowser === '' ? site : site}
                      onChange={(e) => { setSite(e.target.value); setPage(1) }}
                      className={colSelectClass}
                    >
                      {SITE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label === 'Tất cả' ? 'Tất cả' : s.label}</option>
                      ))}
                    </select>
                  </th>

                  {/* IP filter */}
                  <th className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <input
                        value={fIpInput}
                        onChange={(e) => setFIpInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyIp()}
                        placeholder="IP..."
                        className={colInputClass}
                      />
                      {fIp && (
                        <button onClick={() => { setFIp(''); setFIpInput(''); setPage(1) }} className="text-gray-500 hover:text-red-400">✕</button>
                      )}
                    </div>
                  </th>

                  {/* Country filter */}
                  <th className="px-2 py-1.5">
                    <select
                      value={fCountry}
                      onChange={(e) => { setFCountry(e.target.value); setPage(1) }}
                      className={colSelectClass}
                    >
                      <option value="">Tất cả</option>
                      {(stats?.topCountries ?? []).map((c) => (
                        <option key={c.country} value={c.country || ''}>{c.country || '??'}</option>
                      ))}
                    </select>
                  </th>

                  {/* Path filter */}
                  <th className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <input
                        value={fPathInput}
                        onChange={(e) => setFPathInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyPath()}
                        placeholder="Path..."
                        className={colInputClass}
                      />
                      {fPath && (
                        <button onClick={() => { setFPath(''); setFPathInput(''); setPage(1) }} className="text-gray-500 hover:text-red-400">✕</button>
                      )}
                    </div>
                  </th>

                  {/* Device filter */}
                  <th className="px-2 py-1.5">
                    <select
                      value={fDevice}
                      onChange={(e) => { setFDevice(e.target.value); setPage(1) }}
                      className={colSelectClass}
                    >
                      <option value="">Tất cả</option>
                      {(stats?.byDevice ?? []).map((d) => (
                        <option key={d.device} value={d.device || ''}>{d.device || '-'}</option>
                      ))}
                    </select>
                  </th>

                  {/* Browser filter */}
                  <th className="px-2 py-1.5">
                    <select
                      value={fBrowser}
                      onChange={(e) => { setFBrowser(e.target.value); setPage(1) }}
                      className={colSelectClass}
                    >
                      <option value="">Tất cả</option>
                      {(stats?.byBrowser ?? []).map((b) => (
                        <option key={b.browser} value={b.browser || ''}>{b.browser || '-'}</option>
                      ))}
                    </select>
                  </th>

                  {/* User filter */}
                  <th className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <input
                        value={fUserInput}
                        onChange={(e) => setFUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyUser()}
                        placeholder="Email..."
                        className={colInputClass}
                      />
                      {fUser && (
                        <button onClick={() => { setFUser(''); setFUserInput(''); setPage(1) }} className="text-gray-500 hover:text-red-400">✕</button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        log.site === 'rutgon' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'
                      }`}>
                        {log.site}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-blue-400">
                      <button
                        onClick={() => { setFIpInput(log.ip); setFIp(log.ip); setPage(1) }}
                        className="hover:underline"
                      >
                        {log.ip}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-gray-400">
                      {log.country ? (
                        <button onClick={() => { setFCountry(log.country); setPage(1) }} className="hover:text-blue-400">
                          {log.country}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-2 font-mono text-gray-300 max-w-[200px] truncate" title={log.path}>
                      <button onClick={() => { setFPathInput(log.path); setFPath(log.path); setPage(1) }} className="hover:text-blue-400 text-left truncate max-w-[200px] block">
                        {log.path}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-gray-400">
                      {log.device ? (
                        <button onClick={() => { setFDevice(log.device); setPage(1) }} className="hover:text-blue-400">
                          {log.device}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-2 text-gray-400">
                      {log.browser ? (
                        <button onClick={() => { setFBrowser(log.browser); setPage(1) }} className="hover:text-blue-400">
                          {log.browser}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-2 py-2 text-sky-400">
                      {log.userEmail ? (
                        <button onClick={() => { setFUserInput(log.userEmail!); setFUser(log.userEmail!); setPage(1) }} className="hover:underline">
                          {log.userEmail}
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">Trang {page}/{pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-xs bg-gray-800 text-gray-400 rounded disabled:opacity-40 hover:bg-gray-700"
              >
                ← Trước
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs bg-gray-800 text-gray-400 rounded disabled:opacity-40 hover:bg-gray-700"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
