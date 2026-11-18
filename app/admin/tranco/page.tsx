'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { AdminBadge, AdminLoading } from '../_components/AdminUi'

type TargetInfo = {
  domain: string
  beaconBaseUrl: string
}

type TrancoPayload = {
  enabled: boolean
  domains: string[]
  updatedAt: string | null
  updatedBy: string | null
  canWrite: boolean
  targets: TargetInfo[]
  suggestedDomains: string[]
}

export default function AdminTrancoPage() {
  const [data, setData] = useState<TrancoPayload | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [domains, setDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    const response = await fetch('/api/admin/tranco', { cache: 'no-store' })
    const json = await response.json()
    if (!response.ok) {
      setError(json.error || 'Không tải được cấu hình kéo Tranco Top-1M')
      return
    }
    setData(json)
    setEnabled(Boolean(json.enabled))
    setDomains(json.domains || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const addDomain = (raw: string) => {
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '')
    if (!cleaned) return
    setDomains((current) => (current.includes(cleaned) ? current : [...current, cleaned]))
    setNewDomain('')
    setEnabled(true)
  }

  const removeDomain = (domain: string) => {
    setDomains((current) => current.filter((item) => item !== domain))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/tranco', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, domains }),
      })
      const json = await response.json()
      if (!response.ok) {
        setError(json.error || 'Không thể lưu cấu hình kéo Tranco Top-1M')
        return
      }
      setData(json)
      setEnabled(Boolean(json.enabled))
      setDomains(json.domains || [])
      setMessage(
        json.enabled
          ? `Đã lưu và đang kéo ${json.domains.length} domain vào Tranco Top-1M.`
          : 'Đã lưu trạng thái tạm dừng kéo Tranco Top-1M.',
      )
    } catch {
      setError('Lỗi kết nối khi lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  if (!data && !error) return <AdminLoading />
  if (!data) return <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-red-300">{error}</div>

  const unusedSuggestions = (data.suggestedDomains || []).filter((item) => !domains.includes(item))

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Kéo Domain vào Tranco Top-1M</h1>
          <p className="mt-1 text-sm text-gray-400">
            Khi người dùng thật mở bài viết trên <code className="text-gray-300">ca33newss.xyz</code> (hoặc các domain khác), trình duyệt sẽ phân giải DNS ngầm (<code className="text-gray-300">1.1.1.1</code> / OpenDNS) để kéo các domain bên dưới vào bảng xếp hạng Tranco Top-1M phục vụ bình luận <code className="text-gray-300">l.php</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminBadge
            value={data.enabled ? 'active' : 'cancelled'}
            label={data.enabled ? `Đang kéo ${data.domains.length} domain` : 'Đang tắt'}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3.5">
            <div>
              <div className="text-sm font-semibold text-white">Kích hoạt kéo DNS Tranco Top-1M</div>
              <div className="mt-0.5 text-xs text-gray-400">
                Chạy ngầm sau khi trang hiển thị xong, 1 lần/ngày/thiết bị từ bộ nhớ đệm Cloudflare Edge (0% tải cho host gốc).
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!data.canWrite}
                onChange={(event) => setEnabled(event.target.checked)}
                className="h-5 w-5 accent-red-600"
              />
              <span className="text-sm font-semibold text-gray-200">{enabled ? 'Bật' : 'Tắt'}</span>
            </label>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-300">
              Danh sách domain đang kéo ({domains.length}/10)
            </div>
            {domains.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-gray-950 p-4 text-xs text-gray-500">
                Chưa có domain nào trong danh sách. Hãy thêm ở ô bên dưới.
              </div>
            ) : (
              <div className="space-y-2">
                {domains.map((domain) => {
                  const target = data.targets.find((item) => item.domain === domain)
                  return (
                    <div
                      key={domain}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          <span className="truncate">{domain}</span>
                        </div>
                        <div className="mt-0.5 truncate pl-6 text-xs text-gray-500">
                          Beacon Edge: {target?.beaconBaseUrl || `https://${domain}/t.gif`}?d=YYYYMMDD
                        </div>
                      </div>
                      {data.canWrite && (
                        <button
                          type="button"
                          onClick={() => removeDomain(domain)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                          title="Gỡ domain này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {data.canWrite && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(event) => setNewDomain(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addDomain(newDomain)
                    }
                  }}
                  placeholder="Nhập domain muốn kéo (ví dụ: honghotngay228.site, mesale.vn...)"
                  className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-red-500"
                />
                <button
                  type="button"
                  disabled={!newDomain.trim() || domains.length >= 10}
                  onClick={() => addDomain(newDomain)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Thêm
                </button>
              </div>

              {unusedSuggestions.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Thêm nhanh domain quen thuộc của bạn:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unusedSuggestions.map((candidate) => (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => addDomain(candidate)}
                        className="rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs text-gray-300 hover:border-gray-700 hover:bg-gray-800 hover:text-white"
                      >
                        + {candidate}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-gray-500">
              {data.updatedAt
                ? `Cập nhật lần cuối: ${new Date(data.updatedAt).toLocaleString('vi-VN')}${data.updatedBy ? ` (${data.updatedBy})` : ''}`
                : 'Đang chạy cấu hình mặc định (honghotngay228.site).'}
            </div>
            <button
              type="button"
              disabled={!data.canWrite || saving || (enabled && domains.length === 0)}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Nguyên lý lên hạng Tranco Top-1M
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-400">
              <li>
                Tranco tính trung bình trượt 30 ngày từ lượng thiết bị thật phân giải DNS trên{' '}
                <strong className="text-gray-200">Cloudflare 1.1.1.1</strong> và{' '}
                <strong className="text-gray-200">Cisco Umbrella (OpenDNS)</strong>.
              </li>
              <li>
                Trang người xem thật gắn đồng thời <code className="text-gray-300">dns-prefetch</code> +{' '}
                <code className="text-gray-300">preconnect</code> và ảnh 42-byte{' '}
                <code className="text-gray-300">/t.gif</code> (cache cứng 30 ngày tại Cloudflare Edge).
              </li>
              <li>
                Duy trì lưu lượng ổn định khoảng <strong className="text-gray-200">2–4 tuần</strong> giúp domain tự động lọt vào bảng xếp hạng <code className="text-gray-300">tranco-list.eu</code> để qua thẳng bộ lọc <code className="text-gray-300">l.php</code> của Facebook.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
              An toàn cho SEO & Facebook Bot
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-400">
              <li>
                <strong className="text-gray-200">Ẩn 100% với Bot Meta:</strong> Khi <code className="text-gray-300">facebookexternalhit</code> / <code className="text-gray-300">meta-externalagent</code> quét link, HTML trả về không chứa bất kỳ domain kéo theo nào.
              </li>
              <li>
                <strong className="text-gray-200">Không lộ Referer & Cookie:</strong> Mọi ping nền dùng <code className="text-gray-300">referrerPolicy=&quot;no-referrer&quot;</code>, không tạo backlink rác trên Google.
              </li>
              <li>
                <strong className="text-gray-200">Ẩn với User thường:</strong> Chỉ hiển thị trong Admin Panel.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
