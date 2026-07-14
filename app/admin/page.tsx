'use client';

import {useEffect, useState} from 'react';
import {Users, Link2, MousePointerClick, UserPlus, ArrowUpRight} from 'lucide-react';
import {formatDate} from '@/lib/utils';

interface Stats {
    totalUsers: number;
    totalLinks: number;
    totalClicks: number;
    newUsersThisMonth: number;
    newLinksThisMonth: number;
    clicksToday: number;
    clicksThisMonth: number;
    recentUsers: Array<{id: string; name: string | null; email: string; createdAt: string}>;
}

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
}) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{label}</span>
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{backgroundColor: `${color}20`}}
                >
                    <Icon className="w-4 h-4" style={{color}} />
                </div>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

export default function AdminPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then((r) => r.json())
            .then(setStats)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!stats) return <div className="text-red-400">Không thể tải dữ liệu</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-white">Tổng quan hệ thống</h1>
                <p className="text-gray-500 text-sm mt-0.5">Dữ liệu toàn bộ nền tảng LinkShort</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    icon={Users}
                    label="Tổng người dùng"
                    value={stats.totalUsers.toLocaleString()}
                    sub={`+${stats.newUsersThisMonth} tháng này`}
                    color="#ef4444"
                />
                <StatCard
                    icon={Link2}
                    label="Tổng link"
                    value={stats.totalLinks.toLocaleString()}
                    sub={`+${stats.newLinksThisMonth} tháng này`}
                    color="#3b82f6"
                />
                <StatCard
                    icon={MousePointerClick}
                    label="Tổng clicks"
                    value={stats.totalClicks.toLocaleString()}
                    sub={`${stats.clicksToday.toLocaleString()} hôm nay`}
                    color="#10b981"
                />
            </div>

            {/* Recent users */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-white">Người dùng mới nhất</h2>
                    </div>
                    <a
                        href="/admin/users"
                        className="text-xs text-red-400 hover:underline flex items-center gap-1"
                    >
                        Quản lý <ArrowUpRight className="w-3 h-3" />
                    </a>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-500 text-xs border-b border-gray-800">
                                <th className="text-left pb-2 font-medium">Người dùng</th>
                                <th className="text-left pb-2 font-medium">Ngày đăng ký</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentUsers.map((u) => (
                                <tr key={u.id} className="border-b border-gray-800/50 last:border-0">
                                    <td className="py-2.5">
                                        <div className="font-medium text-white">{u.name || '—'}</div>
                                        <div className="text-xs text-gray-500">{u.email}</div>
                                    </td>
                                    <td className="py-2.5 text-gray-500 text-xs">
                                        {formatDate(new Date(u.createdAt))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
