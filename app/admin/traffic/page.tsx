'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Activity, Clock, Globe, Monitor } from 'lucide-react'

interface TrafficData {
  dailyClicks: Array<{ date: string; count: number }>
  hourlyClicks: Array<{ hour: number; count: number }>
  topCountries: Array<{ country: string; count: number }>
  topBrowsers: Array<{ browser: string; count: number }>
  topDevices: Array<{ device: string; count: number }>
  total: number
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
const DAYS_OPTIONS = [7, 14, 30, 60, 90]

const TOOLTIP_STYLE = {
  contentStyle: { background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff' },
  cursor: { fill: '#ffffff08' },
}

function peakHour(hourly: Array<{ hour: number; count: number }>) {
  if (!hourly.length) return null
  return hourly.reduce((max, h) => h.count > max.count ? h : max, hourly[0])
}

export default function AdminTrafficPage() {
  const [data, setData] = useState<TrafficData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/traffic?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [days])

  const peak = data ? peakHour(data.hourlyClicks) : null

  const hourlyWithLabel = data?.hourlyClicks.map(h => ({
    ...h,
    label: `${String(h.hour).padStart(2, '0')}:00`,
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Traffic Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data ? `${data.total.toLocaleString()} clicks trong ${days} ngày qua` : '…'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${days === d ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-red-400">Không thể tải dữ liệu</div>
      ) : (
        <>
          {/* Highlight cards */}
          {peak && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-gray-400">Giờ cao điểm</span>
                </div>
                <div className="text-2xl font-bold text-white">{String(peak.hour).padStart(2, '0')}:00</div>
                <div className="text-xs text-gray-500">{peak.count.toLocaleString()} clicks</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Top quốc gia</span>
                </div>
                <div className="text-2xl font-bold text-white">{data.topCountries[0]?.country ?? '—'}</div>
                <div className="text-xs text-gray-500">{data.topCountries[0]?.count.toLocaleString() ?? 0} clicks</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span className="text-xs text-gray-400">Top trình duyệt</span>
                </div>
                <div className="text-2xl font-bold text-white">{data.topBrowsers[0]?.browser ?? '—'}</div>
                <div className="text-xs text-gray-500">{data.topBrowsers[0]?.count.toLocaleString() ?? 0} clicks</div>
              </div>
            </div>
          )}

          {/* Daily clicks line chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Clicks theo ngày</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.dailyClicks} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={v => v.slice(5)}
                  axisLine={false} tickLine={false}
                  interval={Math.floor(data.dailyClicks.length / 6)}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toLocaleString(), 'Clicks']} labelFormatter={l => `Ngày ${l}`} />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Phân bổ theo giờ trong ngày</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyWithLabel} barSize={14} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toLocaleString(), 'Clicks']} />
                <Bar dataKey="count" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top countries */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white">Top quốc gia</h2>
              </div>
              <div className="space-y-2">
                {data.topCountries.map((c, i) => {
                  const maxCount = data.topCountries[0]?.count ?? 1
                  const pct = Math.round((c.count / maxCount) * 100)
                  return (
                    <div key={c.country} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                      <span className="text-sm text-gray-300 w-10 font-mono">{c.country || '?'}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-16 text-right">{c.count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Devices pie */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white">Thiết bị</h2>
              </div>
              {data.topDevices.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.topDevices}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {data.topDevices.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toLocaleString(), 'Clicks']} />
                    <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-600 text-sm">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
