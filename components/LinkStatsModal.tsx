'use client';

import {useState, useEffect} from 'react';
import {Modal, Tabs, Segmented, Spin} from 'antd';
import {
    TrendingUp,
    Globe,
    Monitor,
    Chrome,
    Smartphone,
    Tablet,
    Clock,
    RefreshCw,
    MousePointer,
    BarChart2,
    Languages,
    Link2,
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    AreaChart,
    Area,
} from 'recharts';

interface LinkInfo {
    id: string;
    shortCode: string;
    shortUrl: string;
    title: string | null;
}

interface Props {
    link: LinkInfo;
    onClose: () => void;
}

interface AnalyticsData {
    totalClicks: number;
    dailyClicks: {date: string; count: number}[];
    byHour: {hour: number; count: number}[];
    byCountry: {country: string; count: number}[];
    byDevice: {device: string; count: number}[];
    byBrowser: {browser: string; count: number}[];
    byOS: {os: string; count: number}[];
    byLanguage: {language: string; count: number}[];
    byReferer: {referer: string; count: number}[];
    recentClicks: {
        createdAt: string;
        country: string | null;
        city: string | null;
        device: string | null;
        browser: string | null;
        os: string | null;
        language: string | null;
        referer: string | null;
        ip: string | null;
    }[];
}

const COLORS = ['#16a34a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
    mobile: <Smartphone className="w-3.5 h-3.5" />,
    tablet: <Tablet className="w-3.5 h-3.5" />,
    desktop: <Monitor className="w-3.5 h-3.5" />,
};

const COUNTRY_FLAGS: Record<string, string> = {
    VN: '🇻🇳',
    US: '🇺🇸',
    GB: '🇬🇧',
    JP: '🇯🇵',
    KR: '🇰🇷',
    CN: '🇨🇳',
    SG: '🇸🇬',
    TH: '🇹🇭',
    AU: '🇦🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    IN: '🇮🇳',
    BR: '🇧🇷',
    CA: '🇨🇦',
    ID: '🇮🇩',
    MY: '🇲🇾',
    PH: '🇵🇭',
    TW: '🇹🇼',
};

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'});
}

function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
    });
}

const STAT_COLOR_STYLES: Record<string, {wrapper: string; icon: string; value: string; label: string}> = {
    blue: {
        wrapper: 'bg-sky-50 border-sky-100',
        icon: 'bg-sky-100 text-sky-600',
        value: 'text-sky-700',
        label: 'text-sky-600',
    },
    emerald: {
        wrapper: 'bg-emerald-50 border-emerald-100',
        icon: 'bg-emerald-100 text-emerald-600',
        value: 'text-emerald-700',
        label: 'text-emerald-600',
    },
    violet: {
        wrapper: 'bg-violet-50 border-violet-100',
        icon: 'bg-violet-100 text-violet-600',
        value: 'text-violet-700',
        label: 'text-violet-600',
    },
    amber: {
        wrapper: 'bg-amber-50 border-amber-100',
        icon: 'bg-amber-100 text-amber-600',
        value: 'text-amber-700',
        label: 'text-amber-600',
    },
};

function StatCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color: string;
}) {
    const s = STAT_COLOR_STYLES[color] || STAT_COLOR_STYLES.blue;
    return (
        <div className={`${s.wrapper} border rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 ${s.icon} rounded-xl flex items-center justify-center shrink-0`}>{icon}</div>
            <div>
                <div className={`text-xl font-bold ${s.value}`}>{value}</div>
                <div className={`text-xs ${s.label}`}>{label}</div>
            </div>
        </div>
    );
}

export default function LinkStatsModal({link, onClose}: Props) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/links/${link.id}/analytics?days=${days}`);
                const json = await res.json();
                setData(json);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [link.id, days]);

    const topDevice = data?.byDevice.sort((a, b) => b.count - a.count)[0]?.device;
    const topBrowser = data?.byBrowser[0]?.browser;

    const overviewContent = !data ? null : (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                    icon={<MousePointer className="w-5 h-5" />}
                    label="Tổng lượt click"
                    value={data.totalClicks.toLocaleString()}
                    color="blue"
                />
                <StatCard
                    icon={<Globe className="w-5 h-5" />}
                    label="Quốc gia"
                    value={data.byCountry.filter((c) => c.country !== 'Unknown').length}
                    color="emerald"
                />
                <StatCard
                    icon={<Monitor className="w-5 h-5" />}
                    label="Thiết bị chính"
                    value={topDevice || '—'}
                    color="violet"
                />
                <StatCard
                    icon={<Chrome className="w-5 h-5" />}
                    label="Trình duyệt chính"
                    value={topBrowser || '—'}
                    color="amber"
                />
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                    Lượt click theo ngày ({days} ngày qua)
                </h3>
                {data.dailyClicks.every((d) => d.count === 0) ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>
                ) : (
                    <ResponsiveContainer
                        width="100%"
                        height={200}
                    >
                        <AreaChart data={data.dailyClicks}>
                            <defs>
                                <linearGradient
                                    id="clickGrad"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="#16a34a"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="#16a34a"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f0f0f0"
                            />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatDate}
                                tick={{fontSize: 11}}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{fontSize: 11}}
                                allowDecimals={false}
                            />
                            <Tooltip
                                labelFormatter={(v) =>
                                    new Date(v).toLocaleDateString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})
                                }
                                formatter={(v) => [Number(v ?? 0), 'Clicks']}
                                contentStyle={{borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12}}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#16a34a"
                                strokeWidth={2}
                                fill="url(#clickGrad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Phân bố theo giờ trong ngày
                </h3>
                <ResponsiveContainer
                    width="100%"
                    height={150}
                >
                    <BarChart
                        data={data.byHour}
                        barSize={14}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                        />
                        <XAxis
                            dataKey="hour"
                            tickFormatter={(h) => `${h}h`}
                            tick={{fontSize: 10}}
                        />
                        <YAxis
                            tick={{fontSize: 10}}
                            allowDecimals={false}
                        />
                        <Tooltip
                            formatter={(v) => [Number(v ?? 0), 'Clicks']}
                            labelFormatter={(h) => `${h}:00 - ${h}:59`}
                            contentStyle={{borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12}}
                        />
                        <Bar
                            dataKey="count"
                            fill="#f59e0b"
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

    const geoContent = !data ? null : (
        <div className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    Lượt click theo quốc gia
                </h3>
                {data.byCountry.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có dữ liệu</div>
                ) : (
                    <div className="space-y-2.5">
                        {data.byCountry.slice(0, 20).map((item, i) => {
                            const pct = data.totalClicks > 0 ? Math.round((item.count / data.totalClicks) * 100) : 0;
                            return (
                                <div
                                    key={item.country}
                                    className="flex items-center gap-3"
                                >
                                    <span className="w-5 text-xs text-gray-400 text-right shrink-0">{i + 1}</span>
                                    <span className="text-lg shrink-0 w-7">{COUNTRY_FLAGS[item.country] || '🏳️'}</span>
                                    <span className="text-sm text-gray-700 w-24 shrink-0 font-medium">
                                        {item.country}
                                    </span>
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="h-2 rounded-full transition-all"
                                            style={{width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length]}}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-700 w-8 text-right">
                                        {item.count}
                                    </span>
                                    <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {data.byCountry.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Top quốc gia (biểu đồ)</h3>
                    <ResponsiveContainer
                        width="100%"
                        height={200}
                    >
                        <BarChart
                            data={data.byCountry.slice(0, 10)}
                            layout="vertical"
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f0f0f0"
                            />
                            <XAxis
                                type="number"
                                tick={{fontSize: 11}}
                                allowDecimals={false}
                            />
                            <YAxis
                                dataKey="country"
                                type="category"
                                tick={{fontSize: 11}}
                                width={40}
                            />
                            <Tooltip
                                formatter={(v) => [Number(v ?? 0), 'Clicks']}
                                contentStyle={{borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12}}
                            />
                            <Bar
                                dataKey="count"
                                radius={[0, 4, 4, 0]}
                            >
                                {data.byCountry.slice(0, 10).map((_, i) => (
                                    <Cell
                                        key={i}
                                        fill={COLORS[i % COLORS.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );

    const techContent = !data ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-violet-500" />
                    Thiết bị
                </h3>
                {data.byDevice.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>
                ) : (
                    <div className="flex items-center gap-4">
                        <ResponsiveContainer
                            width={140}
                            height={140}
                        >
                            <PieChart>
                                <Pie
                                    data={data.byDevice}
                                    dataKey="count"
                                    nameKey="device"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    innerRadius={30}
                                >
                                    {data.byDevice.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={COLORS[i % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v) => [Number(v ?? 0), 'Clicks']}
                                    contentStyle={{borderRadius: 12, fontSize: 12}}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 flex-1">
                            {data.byDevice.map((item, i) => (
                                <div
                                    key={item.device}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{backgroundColor: COLORS[i % COLORS.length]}}
                                    />
                                    <span className="text-gray-600 flex items-center gap-1 text-xs capitalize flex-1">
                                        {DEVICE_ICONS[item.device.toLowerCase()] || <Monitor className="w-3.5 h-3.5" />}
                                        {item.device}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-700">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Chrome className="w-4 h-4 text-sky-500" />
                    Trình duyệt
                </h3>
                <div className="space-y-2">
                    {data.byBrowser.slice(0, 8).map((item, i) => {
                        const pct = data.totalClicks > 0 ? Math.round((item.count / data.totalClicks) * 100) : 0;
                        return (
                            <div
                                key={item.browser}
                                className="flex items-center gap-2"
                            >
                                <span className="text-xs text-gray-600 w-24 truncate">{item.browser}</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="h-1.5 rounded-full"
                                        style={{width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length]}}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{item.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-500" />
                    Hệ điều hành
                </h3>
                <div className="space-y-2">
                    {data.byOS.slice(0, 8).map((item, i) => {
                        const pct = data.totalClicks > 0 ? Math.round((item.count / data.totalClicks) * 100) : 0;
                        return (
                            <div
                                key={item.os}
                                className="flex items-center gap-2"
                            >
                                <span className="text-xs text-gray-600 w-28 truncate">{item.os}</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="h-1.5 rounded-full"
                                        style={{width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length]}}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{item.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Languages className="w-4 h-4 text-pink-500" />
                    Ngôn ngữ trình duyệt
                </h3>
                <div className="space-y-2">
                    {data.byLanguage.slice(0, 8).map((item, i) => {
                        const pct = data.totalClicks > 0 ? Math.round((item.count / data.totalClicks) * 100) : 0;
                        return (
                            <div
                                key={item.language}
                                className="flex items-center gap-2"
                            >
                                <span className="text-xs text-gray-600 w-24 truncate uppercase font-mono">
                                    {item.language}
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="h-1.5 rounded-full"
                                        style={{width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length]}}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{item.count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {data.byReferer.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5 md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-teal-500" />
                        Nguồn truy cập
                    </h3>
                    <div className="space-y-2">
                        {data.byReferer.slice(0, 10).map((item, i) => {
                            const pct = data.totalClicks > 0 ? Math.round((item.count / data.totalClicks) * 100) : 0;
                            return (
                                <div
                                    key={item.referer}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        className="text-xs text-gray-600 flex-1 truncate max-w-xs"
                                        title={item.referer}
                                    >
                                        {item.referer}
                                    </span>
                                    <div className="w-32 bg-gray-200 rounded-full h-1.5">
                                        <div
                                            className="h-1.5 rounded-full"
                                            style={{width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length]}}
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 w-6 text-right">
                                        {item.count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    const recentContent = !data ? null : (
        <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-500" />
                    {data.recentClicks.length} lượt truy cập gần nhất
                </h3>
            </div>
            {data.recentClicks.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Chưa có dữ liệu</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr className="bg-white border-b border-gray-100">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Thời gian
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Quốc gia
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Thiết bị
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Trình duyệt
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    HĐH
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Ngôn ngữ
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.recentClicks.map((click, i) => (
                                <tr
                                    key={i}
                                    className="hover:bg-white transition-colors"
                                >
                                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                        {formatDateTime(click.createdAt)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="flex items-center gap-1 text-xs">
                                            <span>{COUNTRY_FLAGS[click.country || ''] || '🏳️'}</span>
                                            <span className="text-gray-600">{click.country || '—'}</span>
                                            {click.city && <span className="text-gray-400">({click.city})</span>}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-600 capitalize">
                                        {click.device || '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-600">{click.browser || '—'}</td>
                                    <td className="px-4 py-2.5 text-xs text-gray-600">{click.os || '—'}</td>
                                    <td className="px-4 py-2.5 text-xs text-gray-500 uppercase font-mono">
                                        {click.language || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const modalTitle = (
        <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
                    <BarChart2 className="w-4.5 h-4.5 text-sky-600" />
                </div>
                <div>
                    <div className="font-semibold text-gray-900 text-sm">Thống kê</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Link2 className="w-3 h-3 text-sky-500" />
                        <span className="text-xs text-sky-600 font-medium">{link.shortUrl}</span>
                        {link.title && <span className="text-xs text-gray-400">— {link.title}</span>}
                    </div>
                </div>
            </div>
            <Segmented
                value={days}
                onChange={(v) => setDays(v as number)}
                options={[
                    {label: '7d', value: 7},
                    {label: '30d', value: 30},
                    {label: '90d', value: 90},
                ]}
            />
        </div>
    );

    const tabItems = [
        {key: 'overview', label: 'Tổng quan', children: overviewContent},
        {key: 'geo', label: 'Địa lý', children: geoContent},
        {key: 'tech', label: 'Thiết bị & Công nghệ', children: techContent},
        {key: 'recent', label: 'Lịch sử truy cập', children: recentContent},
    ];

    return (
        <Modal
            open={true}
            onCancel={onClose}
            width="min(900px, calc(100vw - 24px))"
            title={modalTitle}
            footer={null}
            destroyOnClose
            styles={{body: {maxHeight: '75vh', overflowY: 'auto'}}}
        >
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Spin size="large" />
                        <p className="text-sm text-gray-500 mt-3">Đang tải dữ liệu...</p>
                    </div>
                </div>
            ) : !data ? (
                <div className="flex items-center justify-center h-64 text-gray-500">Không tải được dữ liệu</div>
            ) : (
                <Tabs items={tabItems} />
            )}
        </Modal>
    );
}
