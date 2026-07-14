'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  Timer, MousePointerClick, Key, Link2, ChevronDown, ChevronUp,
  Upload,
} from 'lucide-react'

interface FbTokenMasked {
  id: string
  label: string
  masked: string
  addedAt: string
  status: 'live' | 'die' | 'unknown'
  lastChecked?: string
}

interface Settings {
  tokens: FbTokenMasked[]
  intervalMinutes: number
  minClicksPerDay: number
  debugAllActiveLinks: boolean
  debugDailyAllActiveLinks: boolean
  debugLinkCount: number
  dailyActiveLinkCount: number
  dailyPendingLinkCount: number
}

export default function FbDebugClient() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  // Token section
  const [tokenExpanded, setTokenExpanded] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'bulk' | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newToken, setNewToken] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [checkingAll, setCheckingAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Settings
  const [intervalInput, setIntervalInput] = useState('20')
  const [minClicksInput, setMinClicksInput] = useState('0')
  const [debugAllActiveLinks, setDebugAllActiveLinks] = useState(false)
  const [debugDailyAllActiveLinks, setDebugDailyAllActiveLinks] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')
  const settingsMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [runningNow, setRunningNow] = useState(false)
  const [runNowMsg, setRunNowMsg] = useState('')

  // Scrape test
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{
    ok: boolean
    msg: string
    title?: string | null
    description?: string | null
    image?: string | null
    usedToken?: boolean
    raw?: Record<string, unknown> | null
  } | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/user/fb-debug', { cache: 'no-store' })
    if (res.ok) {
      const data: Settings = await res.json()
      setSettings(data)
      setIntervalInput(String(data.intervalMinutes))
      setMinClicksInput(String(data.minClicksPerDay))
      setDebugAllActiveLinks(data.debugAllActiveLinks)
      setDebugDailyAllActiveLinks(data.debugDailyAllActiveLinks)
    }
    setLoading(false)
  }

  // Auto check-all on load if any tokens are unknown
  useEffect(() => {
    load().then(() => {
      // check after initial load
    })
  }, [])

  useEffect(() => {
    if (!settings) return
    const hasUnknown = settings.tokens.some(t => t.status === 'unknown')
    if (hasUnknown) checkAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.tokens.length])

  const checkAll = async () => {
    setCheckingAll(true)
    const res = await fetch('/api/user/fb-debug', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-all' }),
    })
    if (res.ok) {
      const data = await res.json()
      setSettings(prev => prev ? { ...prev, tokens: data.tokens } : prev)
    }
    setCheckingAll(false)
  }

  const addSingle = async () => {
    if (!newToken.trim()) return
    setAdding(true)
    setAddMsg('')
    const res = await fetch('/api/user/fb-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, token: newToken }),
    })
    if (res.ok) {
      const data = await res.json()
      setSettings(prev => prev ? { ...prev, tokens: data.tokens } : prev)
      setNewLabel('')
      setNewToken('')
      setAddMode(null)
    } else {
      setAddMsg('Thêm thất bại')
    }
    setAdding(false)
  }

  const addBulk = async () => {
    const lines = bulkText.split('\n').filter(l => l.trim())
    if (lines.length === 0) return
    setAdding(true)
    setAddMsg('')
    const res = await fetch('/api/user/fb-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkText }),
    })
    if (res.ok) {
      const data = await res.json()
      setSettings(prev => prev ? { ...prev, tokens: data.tokens } : prev)
      setBulkText('')
      setAddMode(null)
      setAddMsg(`Đã thêm ${data.added} token`)
      setTimeout(() => setAddMsg(''), 3000)
    } else {
      setAddMsg('Thêm thất bại')
    }
    setAdding(false)
  }

  const removeToken = async (id: string) => {
    setDeletingId(id)
    const res = await fetch('/api/user/fb-debug', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId: id }),
    })
    if (res.ok) {
      const data = await res.json()
      setSettings(prev => prev ? { ...prev, tokens: data.tokens } : prev)
    }
    setDeletingId(null)
  }

  const saveSettings = async () => {
    const intervalMinutes = parseInt(intervalInput, 10)
    const minClicksPerDay = parseInt(minClicksInput, 10)
    if (isNaN(intervalMinutes) || intervalMinutes < 1) { setSettingsMsg('Interval phải >= 1'); return }
    if (isNaN(minClicksPerDay) || minClicksPerDay < 0) { setSettingsMsg('Min clicks phải >= 0'); return }

    setSavingSettings(true)
    const res = await fetch('/api/user/fb-debug', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intervalMinutes,
        minClicksPerDay,
        debugAllActiveLinks,
        debugDailyAllActiveLinks,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data) {
      setSettings(prev => prev ? {
        ...prev,
        intervalMinutes: data.intervalMinutes,
        minClicksPerDay: data.minClicksPerDay,
        debugAllActiveLinks: data.debugAllActiveLinks,
        debugDailyAllActiveLinks: data.debugDailyAllActiveLinks,
        debugLinkCount: data.debugLinkCount ?? prev.debugLinkCount,
        dailyActiveLinkCount: data.dailyActiveLinkCount ?? prev.dailyActiveLinkCount,
        dailyPendingLinkCount: data.dailyPendingLinkCount ?? prev.dailyPendingLinkCount,
      } : prev)
    }
    setSavingSettings(false)
    setSettingsMsg(res.ok ? 'Đã lưu' : 'Lưu thất bại')
    if (settingsMsgTimer.current) clearTimeout(settingsMsgTimer.current)
    settingsMsgTimer.current = setTimeout(() => setSettingsMsg(''), 2500)
  }

  const scrapeLink = async () => {
    if (!scrapeUrl.trim()) return
    setScraping(true)
    setScrapeResult(null)
    const res = await fetch('/api/user/fb-debug', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scrape', url: scrapeUrl.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setScrapeResult({
      ok: !!data.ok,
      msg: data.message || (data.ok ? 'Thành công' : 'Thất bại'),
      title: data.title,
      description: data.description,
      image: data.image,
      usedToken: data.usedToken,
      raw: data.raw as Record<string, unknown> | null ?? null,
    })
    setScraping(false)
  }

  const runDebugNow = async () => {
    setRunningNow(true)
    setRunNowMsg('')
    const res = await fetch('/api/user/fb-debug', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run-now', limit: 10 }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) {
      const jobTotal = typeof data.jobTotal === 'number' ? data.jobTotal : data.total ?? 0
      const jobProcessed = typeof data.jobProcessed === 'number' ? data.jobProcessed : data.total ?? 0
      // The API returns before the background batch runs, so show queue/progress totals instead of 0/0.
      if (jobTotal === 0) {
        setRunNowMsg('Không có link đủ điều kiện debug')
      } else if (jobProcessed === 0 && data.jobStatus === 'pending') {
        setRunNowMsg(`Đã xếp hàng ${jobTotal} link, đang debug nền`)
      } else {
        setRunNowMsg(`Đã debug ${data.success}/${jobTotal} link`)
      }
      load().catch(() => {})
    } else {
      setRunNowMsg(data?.error || data?.message || 'Debug thất bại')
    }
    setRunningNow(false)
    setTimeout(() => setRunNowMsg(''), 3500)
  }

  const INTERVAL_PRESETS = [15, 30, 60, 120, 360]
  const CLICKS_PRESETS = [0, 10, 50, 100, 500]

  const liveCount = settings?.tokens.filter(t => t.status === 'live').length ?? 0
  const totalCount = settings?.tokens.length ?? 0
  const intervalNum = parseInt(intervalInput, 10) || 20

  // Smart distribution info
  const debugNowLinks = settings?.debugLinkCount ?? 0
  const dailyActiveLinks = settings?.dailyActiveLinkCount ?? 0
  const dailyPendingLinks = settings?.dailyPendingLinkCount ?? 0
  const linksPerToken = liveCount > 0 ? Math.ceil(debugNowLinks / liveCount) : debugNowLinks

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">Facebook Debug</h1>
        <p className="text-sm text-gray-500">Tự động gọi Facebook re-scrape meta tag theo lịch.</p>
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: Tokens ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Token header — always visible */}
          <div
            className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
            onClick={() => setTokenExpanded(v => !v)}
          >
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">Facebook Tokens</span>
              {totalCount > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-md">
                    {liveCount} live
                  </span>
                  {totalCount - liveCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-md">
                      {totalCount - liveCount} die
                    </span>
                  )}
                </div>
              )}
              {totalCount === 0 && (
                <span className="text-xs text-gray-400">Chưa có token</span>
              )}
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={checkAll}
                disabled={checkingAll || totalCount === 0}
                title="Kiểm tra live/die tất cả"
                className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingAll ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => { setAddMode(m => m ? null : 'single'); setTokenExpanded(true) }}
                className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Thêm
              </button>
              {tokenExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />
              }
            </div>
          </div>

          {/* Expanded content */}
          {tokenExpanded && (
            <>
              {/* Add form */}
              {addMode && (
                <div className="px-4 pb-3 pt-0 border-b border-gray-100 bg-sky-50/40 space-y-2.5">
                  {/* Toggle single / bulk */}
                  <div className="flex gap-1.5 pt-2">
                    <button
                      onClick={() => setAddMode('single')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${addMode === 'single' ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                    >
                      1 token
                    </button>
                    <button
                      onClick={() => setAddMode('bulk')}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${addMode === 'bulk' ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Upload className="w-3 h-3" />
                      Import nhiều
                    </button>
                  </div>

                  {addMode === 'single' ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Tên (tùy chọn)"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                      <input
                        type="password"
                        value={newToken}
                        onChange={e => setNewToken(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addSingle()}
                        placeholder="Access Token *"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <textarea
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        placeholder={"Mỗi dòng 1 token:\nEAAxxxxx...\nEAAyyyyy...\n\nHoặc: TênLabel:EAAxxxxx..."}
                        rows={5}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono resize-none"
                      />
                      <p className="text-xs text-gray-400">
                        {bulkText.split('\n').filter(l => l.trim()).length} token được nhập
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={addMode === 'single' ? addSingle : addBulk}
                      disabled={adding || (addMode === 'single' ? !newToken.trim() : !bulkText.trim())}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      {adding ? 'Đang thêm...' : addMode === 'single' ? 'Thêm' : `Import ${bulkText.split('\n').filter(l=>l.trim()).length} token`}
                    </button>
                    <button onClick={() => { setAddMode(null); setAddMsg('') }} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Hủy</button>
                    {addMsg && <span className="text-xs text-green-600">{addMsg}</span>}
                  </div>
                </div>
              )}

              {/* Token list */}
              {settings && settings.tokens.length > 0 ? (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {settings.tokens.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="text-xs text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{t.label}</div>
                        <div className="text-xs font-mono text-gray-400">{t.masked}</div>
                      </div>
                      {/* Status badge */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        t.status === 'live'    ? 'bg-green-100 text-green-700' :
                        t.status === 'die'     ? 'bg-red-100 text-red-600' :
                                                  'bg-gray-100 text-gray-500'
                      }`}>
                        {t.status === 'live' ? '● LIVE' : t.status === 'die' ? '● DIE' : '?'}
                      </span>
                      <button
                        onClick={() => removeToken(t.id)}
                        disabled={deletingId === t.id}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  Chưa có token nào
                </div>
              )}

              {/* Footer hint */}
              {settings && settings.tokens.length > 1 && (
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Chỉ dùng token <span className="text-green-600 font-medium">LIVE</span> · luân phiên đều theo số link
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Cron settings ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
            <Timer className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">Cài đặt cron</span>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Distribution info */}
            {liveCount > 0 && (
              <div className="flex items-center gap-2 text-xs bg-sky-50 text-sky-700 px-3 py-2 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{liveCount}</strong> token live · mỗi <strong>{intervalNum} phút</strong> debug
                  ~<strong>{linksPerToken}</strong> link/token
                </span>
              </div>
            )}
            {liveCount > 0 && (
              <div className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl space-y-1">
                <div>
                  Debug ngay/cron thường sẽ chạy <strong>{debugNowLinks}</strong> link đủ điều kiện theo cài đặt hiện tại.
                </div>
                {debugDailyAllActiveLinks && (
                  <div>
                    Sang ngày mới sẽ debug <strong>{dailyActiveLinks}</strong> link active, không lọc theo click.
                    {dailyPendingLinks !== dailyActiveLinks ? <> Còn <strong>{dailyPendingLinks}</strong> link chưa debug hôm nay.</> : null}
                  </div>
                )}
              </div>
            )}
            {liveCount === 0 && totalCount > 0 && (
              <div className="flex items-center gap-2 text-xs bg-red-50 text-red-600 px-3 py-2 rounded-xl">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Không có token live — cron sẽ chạy không có token (rate limit thấp)</span>
              </div>
            )}

            {/* Interval */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Tần suất (phút/lần)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={intervalInput}
                  onChange={e => setIntervalInput(e.target.value)}
                  className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <span className="text-xs text-gray-400">phút</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {INTERVAL_PRESETS.map(m => (
                  <button
                    key={m}
                    onClick={() => setIntervalInput(String(m))}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      intervalInput === String(m) ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m < 60 ? `${m}p` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Min clicks */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-gray-400" />
                Tối thiểu click/ngày để debug
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={minClicksInput}
                  onChange={e => setMinClicksInput(e.target.value)}
                  className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <span className="text-xs text-gray-400">click</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {CLICKS_PRESETS.map(n => (
                  <button
                    key={n}
                    onClick={() => setMinClicksInput(String(n))}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      minClicksInput === String(n) ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {n === 0 ? 'Tất cả' : `≥${n}`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">0 = debug tất cả link có multi-URL</p>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugAllActiveLinks}
                  onChange={e => setDebugAllActiveLinks(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-gray-800">Debug tất cả link đang bật</span>
                  <span className="block text-gray-400">Cron và nút debug ngay sẽ quét mọi link active, không chỉ link multi-URL/folder rotation.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugDailyAllActiveLinks}
                  onChange={e => setDebugDailyAllActiveLinks(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-gray-800">Sang ngày mới debug lại tất cả link đang bật</span>
                  <span className="block text-gray-400">Theo giờ Việt Nam, link active chưa được debug trong ngày sẽ được re-scrape lại.</span>
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={runDebugNow}
                disabled={runningNow}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {runningNow ? 'Đang debug...' : 'Debug ngay'}
              </button>
              {runNowMsg && (
                <span className="text-xs font-medium text-indigo-600">{runNowMsg}</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
              {settingsMsg && (
                <span className={`text-xs font-medium ${settingsMsg === 'Đã lưu' ? 'text-green-600' : 'text-red-500'}`}>
                  {settingsMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Test scrape (full width) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100">
          <Link2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Test scrape thủ công</span>
        </div>

        <div className="px-4 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            Nhập short URL để yêu cầu Facebook re-scrape ngay — tương đương bấm &quot;Scrape Again&quot; trên Facebook Sharing Debugger.
          </p>

          <div className="flex gap-2">
            <input
              type="url"
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scrapeLink()}
              placeholder="https://your-domain.com/abc123"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <button
              onClick={scrapeLink}
              disabled={scraping || !scrapeUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Đang gọi...' : 'Re-scrape'}
            </button>
          </div>

          {scrapeResult && (
            <div className={`rounded-xl border p-3.5 space-y-2 ${
              scrapeResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className={`flex items-center gap-2 text-sm font-medium ${
                scrapeResult.ok ? 'text-green-700' : 'text-red-600'
              }`}>
                {scrapeResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {scrapeResult.msg}
                {scrapeResult.usedToken === false && (
                  <span className="text-xs font-normal text-gray-400">(không dùng token)</span>
                )}
              </div>

              {scrapeResult.ok && (scrapeResult.title || scrapeResult.description || scrapeResult.image) && (
                <div className="text-xs space-y-1 border-t border-green-200 pt-2">
                  {scrapeResult.title && <div><span className="text-gray-400">Tiêu đề:</span> <span className="text-gray-900">{scrapeResult.title}</span></div>}
                  {scrapeResult.description && <div><span className="text-gray-400">Mô tả:</span> <span className="text-gray-700">{scrapeResult.description}</span></div>}
                  {scrapeResult.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scrapeResult.image} alt="OG" className="mt-1 rounded-lg max-h-28 object-cover border border-green-200" />
                  )}
                </div>
              )}

              {!scrapeResult.ok && scrapeResult.raw && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" /> Raw response
                  </summary>
                  <pre className="mt-1.5 p-2.5 bg-white rounded-lg border border-red-200 text-gray-500 overflow-auto max-h-32 whitespace-pre-wrap break-all text-[10px]">
                    {JSON.stringify(scrapeResult.raw, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
