'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ExternalLink, RefreshCw, MousePointerClick } from 'lucide-react'
import { CLICK_WINDOWS, type ClickStatsList, type PlatformClicks, type PopupAnalyticsResponse } from '@/lib/popup-analytics'
import { useLivePopupStats } from './PopupClickStats'

function Breakdown({ counts }: { counts?: PlatformClicks }) {
  return <div className="whitespace-nowrap text-xs leading-5"><div className="text-orange-600">Shopee: <strong>{counts?.shopee ?? '...'}</strong></div><div className="text-gray-600">TikTok: <strong>{counts?.tiktok ?? '...'}</strong></div></div>
}

function StatsTable({ kind, list, query, sort, onQuery, onSort, onPage }: {
  kind: 'post' | 'popup'; list?: ClickStatsList; query: string; sort: string;
  onQuery: (value: string) => void; onSort: (value: string) => void; onPage: (value: number) => void;
}) {
  const label = kind === 'post' ? 'bài viết' : 'popup'
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
      <h3 className="font-semibold text-gray-900">Thống kê theo {label}</h3>
      <select aria-label={`Sắp xếp thống kê ${label}`} value={sort} onChange={event => onSort(event.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-xs"><option value="today">Nhiều click hôm nay</option><option value="yesterday">Nhiều click hôm qua</option><option value="newest">Mới nhất</option></select>
      <input aria-label={`Tìm thống kê ${label}`} value={query} onChange={event => onQuery(event.target.value)} placeholder={`Tìm ${label}...`} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm sm:ml-auto sm:max-w-xs" />
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
      <thead className="border-b border-gray-100 bg-slate-50 text-xs text-gray-600"><tr><th className="p-4">{kind === 'post' ? 'Bài viết' : 'Popup'}</th>{CLICK_WINDOWS.map(w => <th key={w.key} className="whitespace-nowrap p-4">{w.label}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-100">{list?.items.map(item => <tr key={item.id} data-testid={`stats-${kind}-${item.id}`}>
        <td className="max-w-sm p-4"><div className="flex items-center gap-3">
          {item.image ? <Image src={item.image} alt="" width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><MousePointerClick className="h-5 w-5" /></span>}
          <div className="min-w-0"><p className="truncate font-semibold text-gray-900">{item.title}</p>
            {kind === 'post' ? <><p className="truncate text-xs text-gray-500">/{item.slug}</p><p className="text-xs text-gray-500">Popup: {item.popupName || 'Không có'}</p><a href={item.publicUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700"><ExternalLink className="h-3 w-3" /> Mở bài viết</a></> : <p className="text-xs text-gray-500">Bài viết liên kết: {item.postCount}</p>}
          </div></div></td>
        {CLICK_WINDOWS.map(w => <td key={w.key} className="p-4"><Breakdown counts={item.stats[w.key]} /></td>)}
      </tr>)}</tbody>
    </table></div>
    {!list && <p role="status" className="p-5 text-sm text-gray-500">Đang tải số click...</p>}
    {list && !list.items.length && <p className="p-5 text-sm text-gray-500">Chưa có {label} phù hợp.</p>}
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500"><span>{list ? `Trang ${list.page}/${Math.max(1, Math.ceil(list.total / list.pageSize))} · ${list.total} ${label}` : '...'}</span><div className="flex gap-2"><button type="button" disabled={!list || list.page <= 1} onClick={() => onPage((list?.page || 1) - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={!list || list.page * list.pageSize >= list.total} onClick={() => onPage((list?.page || 1) + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div>
  </section>
}

export default function PopupAnalytics() {
  const [postQuery, setPostQuery] = useState(''), [popupQuery, setPopupQuery] = useState('')
  const [postSort, setPostSort] = useState('today'), [popupSort, setPopupSort] = useState('today')
  const [postPage, setPostPage] = useState(1), [popupPage, setPopupPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const params = new URLSearchParams({ postQuery, popupQuery, postSort, popupSort, postPage: String(postPage), popupPage: String(popupPage), pageSize: String(pageSize) })
  const { data, error, refresh } = useLivePopupStats<PopupAnalyticsResponse>(`/api/popup-stats?${params}`)
  return <section id="popup-click-analytics" className="min-w-0 space-y-4" aria-label="Thống kê click popup">
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3"><h2 className="font-semibold text-emerald-800">Tổng click popup</h2><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">LIVE · 5S</span><button type="button" onClick={refresh} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-800"><RefreshCw className="h-3.5 w-3.5" /> Cập nhật</button></div>
      <div className="grid grid-cols-2 divide-x divide-emerald-100 lg:grid-cols-4">{CLICK_WINDOWS.map(w => <div key={w.key} className="min-w-0 p-4"><p className="text-xs uppercase text-gray-500">{w.label}</p><p className="my-2 text-3xl font-bold tabular-nums text-emerald-700">{data?.totals[w.key].total ?? '...'}</p><Breakdown counts={data?.totals[w.key]} /></div>)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500"><p className="min-w-0 flex-1">Tính lượt bấm mở Shopee/TikTok, không tính lượt xem bài hay xác nhận mở app. Ngày tính theo giờ Việt Nam (UTC+7).</p><select aria-label="Số dòng thống kê" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPostPage(1); setPopupPage(1) }} className="rounded-lg border border-gray-200 bg-white p-2"><option value="10">10 / trang</option><option value="20">20 / trang</option><option value="25">25 / trang</option></select></div>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error} Số liệu cũ có thể chưa cập nhật.</p>}
    <StatsTable kind="post" list={data?.posts} query={postQuery} sort={postSort} onQuery={value => { setPostQuery(value); setPostPage(1) }} onSort={value => { setPostSort(value); setPostPage(1) }} onPage={setPostPage} />
    <StatsTable kind="popup" list={data?.popups} query={popupQuery} sort={popupSort} onQuery={value => { setPopupQuery(value); setPopupPage(1) }} onSort={value => { setPopupSort(value); setPopupPage(1) }} onPage={setPopupPage} />
    <p className="text-[11px] text-gray-400">Số click bắt đầu ghi từ khi tính năng được triển khai; dữ liệu cũ chưa được ghi nhận sẽ không được tự tạo lại.{data && ` Cập nhật: ${new Date(data.generatedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`}</p>
  </section>
}
