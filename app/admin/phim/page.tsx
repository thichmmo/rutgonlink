'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Plus, Trash2, MousePointerClick, ExternalLink,
    ToggleLeft, ToggleRight, Save, RefreshCw, Monitor,
    Eye, Users, TrendingUp, Globe, Smartphone, BarChart2,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Legend, PieChart, Pie, Cell,
} from 'recharts';
import { formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedirectLink {
    id: string; url: string; label: string | null;
    isActive: boolean; sortOrder: number;
    createdAt: string; updatedAt: string;
    _count: { clicks: number };
}

interface Stats {
    totalClicks: number; clicksToday: number; clicksThisMonth: number; desktopFakeClicks: number;
    clicksByDay: Array<{ date: string; count: number }>;
    clicksByLink: Array<{ linkId: string; url: string; label: string | null; count: number }>;
    totalVisits: number; visitsToday: number; visitsThisMonth: number;
    visitsByDay: Array<{ date: string; count: number }>;
    comparisonByDay: Array<{ date: string; visits: number; clicks: number }>;
    visitsByDevice: Array<{ label: string; count: number }>;
    visitsByBrowser: Array<{ label: string; count: number }>;
    visitsByOs: Array<{ label: string; count: number }>;
    clicksByDevice: Array<{ label: string; count: number }>;
    clicksByBrowser: Array<{ label: string; count: number }>;
    topReferers: Array<{ referer: string; count: number }>;
    ipAnalytics: Array<{ ip: string; visits: number; clicks: number; clickRate: number; lastVisit: string; lastClick: string | null }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#6366f1'];
const TOOLTIP_STYLE = {
    contentStyle: { background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff' },
    labelFormatter: (v: React.ReactNode) => formatDate(new Date(String(v) + 'T00:00:00')),
    cursor: { fill: '#ffffff10' },
};
const DAY_FMT = (v: string) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon: Icon }: {
    label: string; value: string | number; sub?: string; color: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{label}</span>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h2>;
}

function HBarChart({ data, color, label }: { data: Array<{ label: string; count: number }>; color: string; label: string }) {
    const total = data.reduce((s, r) => s + r.count, 0) || 1;
    return (
        <div className="space-y-2">
            {data.slice(0, 8).map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-400 truncate text-right shrink-0">{r.label}</div>
                    <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                        <div
                            className="h-full rounded transition-all"
                            style={{ width: `${(r.count / total) * 100}%`, backgroundColor: color }}
                        />
                    </div>
                    <div className="text-xs text-gray-300 shrink-0 w-16 text-right">
                        {r.count.toLocaleString()} <span className="text-gray-600">({Math.round(r.count / total * 100)}%)</span>
                    </div>
                </div>
            ))}
            {data.length === 0 && <p className="text-gray-600 text-xs">Chưa có dữ liệu {label}</p>}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPhimPage() {
    const [links, setLinks] = useState<RedirectLink[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [days, setDays] = useState(7);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics'>('dashboard');

    const [desktopUrl, setDesktopUrl] = useState('');
    const [desktopSaved, setDesktopSaved] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [ipSortKey, setIpSortKey] = useState<'visits' | 'clicks' | 'clickRate' | 'lastVisit' | 'lastClick'>('visits');
    const [ipSortDir, setIpSortDir] = useState<'asc' | 'desc'>('desc');
    const [editUrl, setEditUrl] = useState('');
    const [editLabel, setEditLabel] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [linksRes, statsRes] = await Promise.all([
            fetch('/api/admin/phim/links'),
            fetch(`/api/admin/phim/stats?days=${days}`),
        ]);
        const linksData = await linksRes.json();
        setLinks(linksData.links ?? []);
        setDesktopUrl(linksData.desktopRedirectUrl ?? '');
        setStats(await statsRes.json());
        setLoading(false);
    }, [days]);

    useEffect(() => { fetchData(); }, [fetchData]);

    async function addLink() {
        if (!newUrl.trim()) return;
        setSaving(true);
        await fetch('/api/admin/phim/links', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: newUrl.trim(), label: newLabel.trim() || null }),
        });
        setNewUrl(''); setNewLabel(''); setSaving(false); fetchData();
    }

    async function toggleActive(link: RedirectLink) {
        await fetch('/api/admin/phim/links', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: link.id, isActive: !link.isActive }),
        });
        fetchData();
    }

    async function deleteLink(id: string) {
        if (!confirm('Xóa link này? Dữ liệu click sẽ bị xóa theo.')) return;
        await fetch(`/api/admin/phim/links?id=${id}`, { method: 'DELETE' });
        fetchData();
    }

    async function saveEdit() {
        if (!editingId || !editUrl.trim()) return;
        setSaving(true);
        await fetch('/api/admin/phim/links', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, url: editUrl.trim(), label: editLabel.trim() || null }),
        });
        setEditingId(null); setSaving(false); fetchData();
    }

    async function saveDesktopUrl() {
        setSaving(true);
        await fetch('/api/admin/phim/links', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ desktopRedirectUrl: desktopUrl }),
        });
        setSaving(false); setDesktopSaved(true);
        setTimeout(() => setDesktopSaved(false), 2000);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const convRate = stats && stats.totalVisits > 0
        ? ((stats.totalClicks / stats.totalVisits) * 100).toFixed(1) : '—';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">Web Phim — vmephim.media</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Thống kê truy cập, click & cấu hình redirect</p>
                </div>
                <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                    <RefreshCw className="w-4 h-4" /> Làm mới
                </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
                {[
                    { key: 'dashboard', label: 'Tổng quan', icon: BarChart2 },
                    { key: 'analytics', label: 'Phân tích', icon: TrendingUp },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as 'dashboard' | 'analytics')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                TAB 1: TỔNG QUAN (Dashboard)
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                    {/* Visit stats */}
                    <div>
                        <SectionTitle>Lượt truy cập trang (lọc bot, không giới hạn IP)</SectionTitle>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StatCard label="Tổng lượt truy cập" value={stats.totalVisits.toLocaleString()} color="#3b82f6" icon={Eye} />
                            <StatCard label="Truy cập hôm nay" value={stats.visitsToday.toLocaleString()} color="#10b981" icon={Eye} />
                            <StatCard label="Truy cập tháng này" value={stats.visitsThisMonth.toLocaleString()} color="#8b5cf6" icon={Eye} />
                            <StatCard label="IP duy nhất" value={stats.ipAnalytics.length.toLocaleString()} sub="trong top 50" color="#06b6d4" icon={Users} />
                        </div>
                    </div>

                    {/* Click stats */}
                    <div>
                        <SectionTitle>Lượt click xem phim (lọc bot)</SectionTitle>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StatCard label="Tổng click" value={stats.totalClicks.toLocaleString()} color="#f97316" icon={MousePointerClick} />
                            <StatCard label="Click hôm nay" value={stats.clicksToday.toLocaleString()} color="#10b981" icon={MousePointerClick} />
                            <StatCard label="Click tháng này" value={stats.clicksThisMonth.toLocaleString()} color="#f59e0b" icon={MousePointerClick} />
                            <StatCard label="Tỉ lệ click/visit" value={`${convRate}%`} sub="conversion rate" color="#ec4899" icon={TrendingUp} />
                        </div>
                    </div>

                    {/* Comparison chart */}
                    {stats.comparisonByDay.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-sm font-semibold text-white">So sánh Truy cập vs Click</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Xanh = vào trang · Cam = click xem phim</p>
                                </div>
                                <select
                                    value={days}
                                    onChange={(e) => setDays(Number(e.target.value))}
                                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1"
                                >
                                    <option value={7}>7 ngày</option>
                                    <option value={14}>14 ngày</option>
                                    <option value={30}>30 ngày</option>
                                </select>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={stats.comparisonByDay}>
                                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={DAY_FMT} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} formatter={(v) => v === 'visits' ? 'Truy cập' : 'Click xem'} />
                                    <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} name="visits" />
                                    <Bar dataKey="clicks" fill="#f97316" radius={[4, 4, 0, 0]} name="clicks" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Click by link */}
                    {stats.clicksByLink.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h2 className="text-sm font-semibold text-white mb-1">Click theo link ({days} ngày)</h2>
                            <p className="text-xs text-gray-500 mb-3">
                                Số lần người dùng <span className="text-orange-400">bấm nút xem phim</span> trên trang (ghi nhận phía client). Khác với số redirect bên dưới.
                            </p>
                            <div className="space-y-2">
                                {stats.clicksByLink.map((item) => (
                                    <div key={item.linkId} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="text-sm text-white truncate">{item.label || item.url}</div>
                                            {item.label && <div className="text-xs text-gray-500 truncate">{item.url}</div>}
                                        </div>
                                        <span className="text-sm font-semibold text-orange-400 shrink-0">{item.count.toLocaleString()} clicks</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Desktop URL */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Monitor className="w-4 h-4 text-blue-400" />
                            <h2 className="text-sm font-semibold text-white">Link redirect cho Desktop</h2>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">PC hoặc F12 giả mobile sẽ redirect sang link này.</p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="https://... (để trống = hiện popup)"
                                value={desktopUrl}
                                onChange={(e) => setDesktopUrl(e.target.value)}
                                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && saveDesktopUrl()}
                            />
                            <button
                                onClick={saveDesktopUrl}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
                            >
                                <Save className="w-4 h-4" />
                                {desktopSaved ? 'Đã lưu!' : 'Lưu'}
                            </button>
                        </div>
                    </div>

                    {/* Add link form */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-white mb-4">Thêm link redirect</h2>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input type="text" placeholder="URL (https://...)" value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                            <input type="text" placeholder="Nhãn (tùy chọn)" value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="sm:w-48 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                            <button onClick={addLink} disabled={saving || !newUrl.trim()}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0">
                                <Plus className="w-4 h-4" /> Thêm
                            </button>
                        </div>
                    </div>

                    {/* Link list */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-white mb-1">Danh sách link redirect ({links.length})</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Số <span className="text-orange-400">clicks</span> ở đây = số lần server thực sự <span className="text-orange-400">redirect</span> người dùng sang link (toàn thời gian). Khác với &quot;click nút xem phim&quot; ở biểu đồ trên — hai số này đo hai hành động khác nhau nên không bằng nhau.
                        </p>
                        {links.length === 0 ? (
                            <p className="text-gray-500 text-sm">Chưa có link nào.</p>
                        ) : (
                            <div className="space-y-3">
                                {links.map((link) => (
                                    <div key={link.id} className={`flex items-center gap-3 p-3 rounded-lg border ${link.isActive ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900 opacity-60'}`}>
                                        <button onClick={() => toggleActive(link)} className="shrink-0" title={link.isActive ? 'Đang bật' : 'Đang tắt'}>
                                            {link.isActive ? <ToggleRight className="w-6 h-6 text-sky-400" /> : <ToggleLeft className="w-6 h-6 text-gray-600" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            {editingId === link.id ? (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                                                        className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:border-orange-500 focus:outline-none" autoFocus />
                                                    <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Nhãn"
                                                        className="sm:w-36 bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:border-orange-500 focus:outline-none" />
                                                    <div className="flex gap-1">
                                                        <button onClick={saveEdit} disabled={saving} className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium"><Save className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs">Hủy</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="cursor-pointer" onClick={() => { setEditingId(link.id); setEditUrl(link.url); setEditLabel(link.label ?? ''); }}>
                                                    <div className="text-sm text-white truncate">
                                                        {link.label && <span className="text-orange-400 mr-2">[{link.label}]</span>}
                                                        {link.url}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">Tạo: {formatDate(new Date(link.createdAt))} · Click để sửa</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm font-medium text-orange-400 shrink-0">
                                            {link._count.clicks.toLocaleString()}<span className="text-gray-500 text-xs ml-1">clicks</span>
                                        </div>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-500 hover:text-gray-300"><ExternalLink className="w-4 h-4" /></a>
                                        <button onClick={() => deleteLink(link.id)} className="shrink-0 text-gray-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                TAB 2: PHÂN TÍCH (Analytics)
            ═══════════════════════════════════════════════════════════ */}
            {activeTab === 'analytics' && stats && (
                <div className="space-y-6">
                    {/* Bộ lọc ngày */}
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">Khoảng thời gian biểu đồ:</span>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5"
                        >
                            <option value={7}>7 ngày</option>
                            <option value={14}>14 ngày</option>
                            <option value={30}>30 ngày</option>
                        </select>
                        <span className="text-gray-600 text-xs">(Breakdown thiết bị/OS/trình duyệt tính tổng toàn thời gian)</span>
                    </div>

                    {/* ── Biểu đồ so sánh theo ngày ── */}
                    {stats.comparisonByDay.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h2 className="text-sm font-semibold text-white mb-1">Truy cập vs Click theo ngày</h2>
                            <p className="text-xs text-gray-500 mb-4">Tỉ lệ chuyển đổi tổng: <span className="text-pink-400 font-semibold">{convRate}%</span></p>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={stats.comparisonByDay}>
                                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={DAY_FMT} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} formatter={(v) => v === 'visits' ? 'Truy cập' : 'Click xem'} />
                                    <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} name="visits" />
                                    <Bar dataKey="clicks" fill="#f97316" radius={[4, 4, 0, 0]} name="clicks" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* ── Biểu đồ truy cập theo ngày ── */}
                    {stats.visitsByDay.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h2 className="text-sm font-semibold text-white mb-4">Truy cập trang theo ngày</h2>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={stats.visitsByDay}>
                                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={DAY_FMT} />
                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Truy cập" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* ── Thiết bị / OS / Trình duyệt ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Device */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Smartphone className="w-4 h-4 text-blue-400" />
                                <h2 className="text-sm font-semibold text-white">Loại thiết bị</h2>
                            </div>
                            {stats.visitsByDevice.length > 0 ? (
                                <>
                                    <HBarChart data={stats.visitsByDevice} color="#3b82f6" label="thiết bị" />
                                    <div className="mt-4">
                                        <ResponsiveContainer width="100%" height={120}>
                                            <PieChart>
                                                <Pie data={stats.visitsByDevice} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={50} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${(((percent ?? 0) * 100).toFixed(0))}%`} labelLine={false} fontSize={10}>
                                                    {stats.visitsByDevice.map((_, i) => (
                                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v) => (typeof v === 'number' ? v.toLocaleString() : String(v))} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            ) : <p className="text-gray-600 text-xs">Chưa có dữ liệu</p>}
                        </div>

                        {/* OS */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Monitor className="w-4 h-4 text-purple-400" />
                                <h2 className="text-sm font-semibold text-white">Hệ điều hành</h2>
                            </div>
                            <HBarChart data={stats.visitsByOs} color="#8b5cf6" label="OS" />
                        </div>

                        {/* Browser */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="w-4 h-4 text-sky-400" />
                                <h2 className="text-sm font-semibold text-white">Trình duyệt</h2>
                            </div>
                            <HBarChart data={stats.visitsByBrowser} color="#10b981" label="trình duyệt" />
                        </div>
                    </div>

                    {/* ── Click: Thiết bị + Trình duyệt ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h2 className="text-sm font-semibold text-white mb-4">Click theo thiết bị</h2>
                            <HBarChart data={stats.clicksByDevice} color="#f97316" label="thiết bị" />
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <h2 className="text-sm font-semibold text-white mb-4">Click theo trình duyệt</h2>
                            <HBarChart data={stats.clicksByBrowser} color="#f59e0b" label="trình duyệt" />
                        </div>
                    </div>

                    {/* ── Nguồn truy cập (Referer) ── */}
                    {stats.topReferers.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-sm font-semibold text-white">Nguồn truy cập (từ đâu đến)</h2>
                            </div>
                            <HBarChart
                                data={stats.topReferers.map((r) => ({ label: r.referer, count: r.count }))}
                                color="#06b6d4"
                                label="referer"
                            />
                        </div>
                    )}

                    {/* ── Phân tích IP ── */}
                    {stats.ipAnalytics.length > 0 && (() => {
                        const fmtVN = (iso: string | null) => {
                            if (!iso) return '—';
                            const d = new Date(iso);
                            return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        };
                        const sorted = [...stats.ipAnalytics].sort((a, b) => {
                            let av: number, bv: number;
                            if (ipSortKey === 'lastVisit') {
                                av = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
                                bv = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
                            } else if (ipSortKey === 'lastClick') {
                                av = a.lastClick ? new Date(a.lastClick).getTime() : 0;
                                bv = b.lastClick ? new Date(b.lastClick).getTime() : 0;
                            } else {
                                av = a[ipSortKey]; bv = b[ipSortKey];
                            }
                            return ipSortDir === 'desc' ? bv - av : av - bv;
                        });
                        const SortTh = ({ col, label, align = 'right' }: { col: typeof ipSortKey; label: string; align?: string }) => (
                            <th
                                className={`text-${align} text-gray-400 font-medium py-2 pr-4 cursor-pointer select-none hover:text-white whitespace-nowrap`}
                                onClick={() => { if (ipSortKey === col) setIpSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setIpSortKey(col); setIpSortDir('desc'); } }}
                            >
                                {label}{ipSortKey === col ? (ipSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                            </th>
                        );
                        return (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-cyan-400" />
                                    <h2 className="text-sm font-semibold text-white">Phân tích IP</h2>
                                    <span className="text-xs text-gray-500 ml-auto">Top 50 IP theo lượt truy cập</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">
                                    Mỗi IP là một thiết bị/người dùng. <span className="text-sky-400">Tỉ lệ click</span> = số lần IP đó click / số lần truy cập.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-800">
                                                <th className="text-left text-gray-400 font-medium py-2 pr-3">#</th>
                                                <th className="text-left text-gray-400 font-medium py-2 pr-4">IP</th>
                                                <SortTh col="visits" label="Truy cập" />
                                                <SortTh col="clicks" label="Click" />
                                                <SortTh col="clickRate" label="Tỉ lệ click" />
                                                <SortTh col="lastVisit" label="Truy cập gần nhất" />
                                                <SortTh col="lastClick" label="Click gần nhất" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map((row, i) => (
                                                <tr key={row.ip} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                                                    <td className="py-2 pr-3 text-gray-600 text-xs">{i + 1}</td>
                                                    <td className="py-2 pr-4 font-mono text-xs text-gray-300">{row.ip}</td>
                                                    <td className="py-2 pr-4 text-right text-blue-400 font-medium">{row.visits.toLocaleString()}</td>
                                                    <td className="py-2 pr-4 text-right text-orange-400 font-medium">{row.clicks.toLocaleString()}</td>
                                                    <td className="py-2 pr-4 text-right">
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                            row.clickRate >= 50 ? 'bg-sky-900/50 text-sky-400' :
                                                            row.clickRate >= 20 ? 'bg-yellow-900/50 text-yellow-400' :
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {row.clickRate}%
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-4 text-right text-xs text-gray-400">{fmtVN(row.lastVisit)}</td>
                                                    <td className="py-2 text-right text-xs text-gray-400">{fmtVN(row.lastClick)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── Desktop fake stats ── */}
                    {stats.desktopFakeClicks > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
                            <Monitor className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <div className="text-sm text-white font-medium">
                                    Desktop giả mobile (F12): <span className="text-red-400">{stats.desktopFakeClicks.toLocaleString()}</span> lần
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">PC bật DevTools responsive mode rồi click vào web phim</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
