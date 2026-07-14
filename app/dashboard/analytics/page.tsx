'use client';

import {useState, useEffect, useCallback} from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    BarChart2,
    MousePointer,
    Globe,
    Smartphone,
    Loader2,
    TrendingUp,
    MapPin,
    Languages,
    Link2,
    Monitor,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const WorldMap = dynamic(() => import('@/components/WorldMap'), {ssr: false});

interface AnalyticsData {
    totalClicks: number;
    todayClicks: number;
    dailyClicks: {date: string; count: number}[];
    byCountry: {country: string; count: number}[];
    byCity: {city: string; country: string; count: number}[];
    byDevice: {device: string; count: number}[];
    byDeviceModel: {deviceModel: string; count: number}[];
    byBrowser: {browser: string; count: number}[];
    byOSDetail: {os: string; count: number}[];
    byLanguage: {language: string; count: number}[];
    byReferer: {referer: string; count: number}[];
}

const COLORS = [
    '#2563EB',
    '#7C3AED',
    '#059669',
    '#D97706',
    '#DC2626',
    '#0891B2',
    '#DB2777',
    '#4F46E5',
    '#0D9488',
    '#CA8A04',
];

const DEVICE_LABELS: Record<string, string> = {
    desktop: 'Máy tính',
    mobile: 'Di động',
    tablet: 'Máy tính bảng',
    Unknown: 'Không xác định',
};

const COUNTRY_NAMES: Record<string, string> = {
    VN: 'Việt Nam',
    US: 'Hoa Kỳ',
    CN: 'Trung Quốc',
    JP: 'Nhật Bản',
    KR: 'Hàn Quốc',
    GB: 'Anh',
    DE: 'Đức',
    FR: 'Pháp',
    IN: 'Ấn Độ',
    BR: 'Brazil',
    AU: 'Australia',
    CA: 'Canada',
    RU: 'Nga',
    SG: 'Singapore',
    TH: 'Thái Lan',
    MY: 'Malaysia',
    ID: 'Indonesia',
    PH: 'Philippines',
    TW: 'Đài Loan',
    HK: 'Hong Kong',
    IT: 'Ý',
    ES: 'Tây Ban Nha',
    NL: 'Hà Lan',
    SE: 'Thụy Điển',
    NO: 'Na Uy',
    PL: 'Ba Lan',
    UA: 'Ukraine',
    TR: 'Thổ Nhĩ Kỳ',
    SA: 'Saudi Arabia',
    AE: 'UAE',
    ZA: 'Nam Phi',
    NG: 'Nigeria',
    EG: 'Ai Cập',
    MX: 'Mexico',
    AR: 'Argentina',
    PT: 'Bồ Đào Nha',
    BE: 'Bỉ',
    CH: 'Thụy Sĩ',
    AT: 'Áo',
    DK: 'Đan Mạch',
    FI: 'Phần Lan',
    CZ: 'Séc',
    RO: 'Romania',
    NZ: 'New Zealand',
    CL: 'Chile',
    CO: 'Colombia',
    PK: 'Pakistan',
    BD: 'Bangladesh',
    MM: 'Myanmar',
    KH: 'Campuchia',
    LA: 'Lào',
    HU: 'Hungary',
    BG: 'Bulgaria',
    RS: 'Serbia',
    SK: 'Slovakia',
};

function getFlagEmoji(code: string): string {
    if (!code || code.length !== 2) return '🌐';
    const c = code.toUpperCase();
    return String.fromCodePoint(c.charCodeAt(0) + 127397, c.charCodeAt(1) + 127397);
}

function RankList({
    items,
    maxCount,
    renderLabel,
    countKey = 'count',
    color = '#2563EB',
}: {
    items: Record<string, unknown>[];
    maxCount: number;
    renderLabel: (item: Record<string, unknown>) => React.ReactNode;
    countKey?: string;
    color?: string;
}) {
    return (
        <div className="space-y-3">
            {items.map((item, i) => {
                const count = item[countKey] as number;
                const pct = Math.round((count / maxCount) * 100);
                return (
                    <div
                        key={i}
                        className="flex items-center gap-3"
                    >
                        <span className="text-xs font-semibold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-700 truncate">{renderLabel(item)}</span>
                                <span className="text-sm font-semibold text-gray-900 ml-2 shrink-0">
                                    {count.toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-1.5">
                                <div
                                    className="rounded-full h-1.5 transition-all"
                                    style={{width: `${pct}%`, backgroundColor: color}}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StatCard({
    icon,
    iconBg,
    iconColor,
    label,
    value,
    sub,
}: {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    label: string;
    value: string | number;
    sub: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
                    <span className={iconColor}>{icon}</span>
                </div>
                <span className="text-sm font-medium text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
        </div>
    );
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/analytics?days=${days}`);
            const json = await res.json();
            setData(json);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        if (!year || !month || !day) return dateStr;
        return `${day}/${month}`;
    };

    const avgPerDay = data ? Math.round(data.totalClicks / days) : 0;

    return (
        <div className="space-y-5 min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900">Thống kê</h1>
                    <p className="text-gray-600 text-sm mt-1">Phân tích chi tiết lượt click</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                    {[7, 30, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 sm:px-4 py-2 text-sm rounded-xl font-medium transition-colors cursor-pointer ${
                                days === d
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {d} ngày
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
                </div>
            ) : !data ? (
                <div className="text-center py-24 text-gray-500">Không thể tải dữ liệu</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard
                            icon={<MousePointer className="w-4 h-4" />}
                            iconBg="bg-sky-50"
                            iconColor="text-sky-600"
                            label="Tổng clicks"
                            value={data.totalClicks.toLocaleString()}
                            sub={`trong ${days} ngày`}
                        />
                        <StatCard
                            icon={<TrendingUp className="w-4 h-4" />}
                            iconBg="bg-orange-50"
                            iconColor="text-orange-500"
                            label="Hôm nay"
                            value={data.todayClicks.toLocaleString()}
                            sub="lượt hôm nay"
                        />
                        <StatCard
                            icon={<BarChart2 className="w-4 h-4" />}
                            iconBg="bg-sky-50"
                            iconColor="text-sky-600"
                            label="TB / ngày"
                            value={avgPerDay.toLocaleString()}
                            sub="clicks mỗi ngày"
                        />
                        <StatCard
                            icon={<Globe className="w-4 h-4" />}
                            iconBg="bg-purple-50"
                            iconColor="text-purple-600"
                            label="Quốc gia"
                            value={data.byCountry.filter((c) => c.country !== 'Unknown').length}
                            sub="quốc gia truy cập"
                        />
                        <StatCard
                            icon={<MapPin className="w-4 h-4" />}
                            iconBg="bg-pink-50"
                            iconColor="text-pink-600"
                            label="Thành phố"
                            value={data.byCity.length}
                            sub="thành phố"
                        />
                        <StatCard
                            icon={<Languages className="w-4 h-4" />}
                            iconBg="bg-teal-50"
                            iconColor="text-teal-600"
                            label="Ngôn ngữ"
                            value={data.byLanguage.filter((l) => l.language !== 'Unknown').length}
                            sub="ngôn ngữ"
                        />
                    </div>

                    {/* Daily Clicks Chart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-sky-600" />
                            Lượt click theo ngày
                        </h2>
                        {data.dailyClicks.length > 0 ? (
                            <ResponsiveContainer
                                width="100%"
                                height={240}
                            >
                                <LineChart data={data.dailyClicks}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f1f5f9"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        tick={{fontSize: 11, fill: '#94a3b8'}}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{fontSize: 11, fill: '#94a3b8'}}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                        }}
                                        labelFormatter={(v) => `Ngày ${formatDate(v as string)}`}
                                        formatter={(value) => [value, 'Clicks']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#2563EB"
                                        strokeWidth={2.5}
                                        dot={false}
                                        activeDot={{r: 5, fill: '#2563EB'}}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center py-12 text-gray-400">Chưa có dữ liệu</div>
                        )}
                    </div>

                    {/* Device + OS + Browser */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Device Type Donut */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-sky-600" />
                                Loại thiết bị
                            </h2>
                            {data.byDevice.length > 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <ResponsiveContainer
                                        width="100%"
                                        height={150}
                                    >
                                        <PieChart>
                                            <Pie
                                                data={data.byDevice}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={42}
                                                outerRadius={68}
                                                paddingAngle={3}
                                                dataKey="count"
                                            >
                                                {data.byDevice.map((_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={COLORS[i % COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v, 'Clicks']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="w-full space-y-2">
                                        {data.byDevice.map((item, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{backgroundColor: COLORS[i % COLORS.length]}}
                                                    />
                                                    <span className="text-gray-700">
                                                        {DEVICE_LABELS[item.device] || item.device}
                                                    </span>
                                                </div>
                                                <span className="font-semibold text-gray-900">
                                                    {item.count.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>

                        {/* OS Detail */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Monitor className="w-5 h-5 text-purple-600" />
                                Hệ điều hành
                            </h2>
                            {data.byOSDetail.length > 0 ? (
                                <RankList
                                    items={data.byOSDetail as Record<string, unknown>[]}
                                    maxCount={data.byOSDetail[0]?.count || 1}
                                    renderLabel={(item) => item.os as string}
                                    color="#7C3AED"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>

                        {/* Browser */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-sky-600" />
                                Trình duyệt
                            </h2>
                            {data.byBrowser.length > 0 ? (
                                <RankList
                                    items={data.byBrowser as Record<string, unknown>[]}
                                    maxCount={data.byBrowser[0]?.count || 1}
                                    renderLabel={(item) => item.browser as string}
                                    color="#059669"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>
                    </div>

                    {/* Language + Device Model */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Language */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Languages className="w-5 h-5 text-teal-600" />
                                Ngôn ngữ
                            </h2>
                            {data.byLanguage.length > 0 ? (
                                <RankList
                                    items={data.byLanguage as Record<string, unknown>[]}
                                    maxCount={data.byLanguage[0]?.count || 1}
                                    renderLabel={(item) => item.language as string}
                                    color="#0891B2"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>

                        {/* Device Model */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-orange-500" />
                                Model thiết bị
                            </h2>
                            {data.byDeviceModel.length > 0 ? (
                                <RankList
                                    items={data.byDeviceModel as Record<string, unknown>[]}
                                    maxCount={data.byDeviceModel[0]?.count || 1}
                                    renderLabel={(item) => item.deviceModel as string}
                                    color="#D97706"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    Chưa có dữ liệu — sẽ xuất hiện sau khi có lượt click mới
                                </div>
                            )}
                        </div>
                    </div>

                    {/* World Map */}
                    {data.byCountry.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-sky-600" />
                                Bản đồ click thế giới
                            </h2>
                            <WorldMap data={data.byCountry.filter((c) => c.country !== 'Unknown')} />
                        </div>
                    )}

                    {/* Country Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-sky-600" />
                                Theo quốc gia
                            </h2>
                        </div>
                        {data.byCountry.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {data.byCountry.map((item, i) => {
                                    const maxCount = data.byCountry[0]?.count || 1;
                                    const pct = Math.round((item.count / maxCount) * 100);
                                    const totalPct = data.totalClicks
                                        ? Math.round((item.count / data.totalClicks) * 100)
                                        : 0;
                                    const code = item.country === 'Unknown' ? '' : item.country;
                                    const name = COUNTRY_NAMES[code] || code || 'Unknown';
                                    return (
                                        <div
                                            key={i}
                                        className="px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4 min-w-0"
                                    >
                                            <span className="text-xs font-semibold text-gray-400 w-5 text-right shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className="text-lg w-7 shrink-0">{getFlagEmoji(code)}</span>
                                            <span className="text-sm font-medium text-gray-900 flex-1 sm:w-28 sm:flex-none truncate min-w-0">
                                                {name}
                                            </span>
                                            <div className="hidden sm:block flex-1 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-sky-500 rounded-full h-1.5 transition-all"
                                                    style={{width: `${pct}%`}}
                                                />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900 w-16 text-right shrink-0">
                                                {item.count.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                                                {totalPct}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* City + Referer */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* City */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-pink-600" />
                                Thành phố
                            </h2>
                            {data.byCity.length > 0 ? (
                                <RankList
                                    items={data.byCity as Record<string, unknown>[]}
                                    maxCount={data.byCity[0]?.count || 1}
                                    renderLabel={(item) => (
                                        <span>
                                            {item.city as string}
                                            {!!item.country && (
                                                <span className="ml-1.5 text-gray-400 text-xs">
                                                    {getFlagEmoji(item.country as string)}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    color="#DB2777"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>

                        {/* Referer / Traffic Source */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Link2 className="w-5 h-5 text-indigo-600" />
                                Nguồn truy cập
                            </h2>
                            {data.byReferer.length > 0 ? (
                                <RankList
                                    items={data.byReferer as Record<string, unknown>[]}
                                    maxCount={data.byReferer[0]?.count || 1}
                                    renderLabel={(item) => (
                                        <span className={item.referer === 'Direct' ? 'text-gray-400 italic' : ''}>
                                            {item.referer as string}
                                        </span>
                                    )}
                                    color="#4F46E5"
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400">Chưa có dữ liệu</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
