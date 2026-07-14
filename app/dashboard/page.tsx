import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth-options';
import {prisma} from '@/lib/prisma';
import {Prisma} from '@prisma/client';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Link2, MousePointer, Globe, TrendingUp} from 'lucide-react';
import {formatNumber, formatDateTimeVN} from '@/lib/utils';
import DashboardQuickShorten from './DashboardQuickShorten';

type RecentLink = Prisma.LinkGetPayload<{
    include: {
        domain: true;
        _count: {select: {clicks: true}};
    };
}>;

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({where: {email: session.user.email}});
    if (!user) redirect('/login');

    const [totalLinks, activeLinks, totalDomains] = await Promise.all([
        prisma.link.count({where: {userId: user.id}}),
        prisma.link.count({where: {userId: user.id, isActive: true}}),
        prisma.domain.count({where: {userId: user.id}}),
    ]);

    const recentLinks: RecentLink[] = await prisma.link.findMany({
        where: {userId: user.id},
        include: {
            domain: true,
            _count: {select: {clicks: true}},
        },
        orderBy: {createdAt: 'desc'},
        take: 5,
    });

    const totalClicks = await prisma.click.count({
        where: {link: {userId: user.id}},
    });

    const stats = [
        {
            label: 'Tổng links',
            value: formatNumber(totalLinks),
            icon: Link2,
            color: 'bg-sky-50 text-sky-600',
            change: null,
        },
        {
            label: 'Tổng lượt click',
            value: formatNumber(totalClicks),
            icon: MousePointer,
            color: 'bg-sky-50 text-sky-600',
            change: null,
        },
        {
            label: 'Links đang hoạt động',
            value: formatNumber(activeLinks),
            icon: TrendingUp,
            color: 'bg-purple-50 text-purple-600',
            change: null,
        },
        {
            label: 'Custom Domains',
            value: formatNumber(totalDomains),
            icon: Globe,
            color: 'bg-orange-50 text-orange-600',
            change: null,
        },
    ];

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 break-words">Xin chào, {user.name || 'bạn'} 👋</h1>
                <p className="text-gray-600 mt-1">Đây là tổng quan tài khoản của bạn.</p>
            </div>

            {/* Quick Shorten */}
            <DashboardQuickShorten />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            {stat.change && (
                                <span className="text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                                    {stat.change}
                                </span>
                            )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                        <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Recent Links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="px-4 sm:px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-gray-900">Links gần đây</h2>
                    <Link
                        href="/dashboard/links"
                        className="text-sm text-sky-600 hover:underline"
                    >
                        Xem tất cả
                    </Link>
                </div>
                {recentLinks.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                        <Link2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p>Chưa có link nào. Hãy tạo link đầu tiên!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {recentLinks.map((link) => {
                            const shortUrl = link.domain
                                ? `https://${link.domain.domain}/${link.shortCode}`
                                : `${baseUrl}/${link.shortCode}`;
                            return (
                                <div
                                    key={link.id}
                                    className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors min-w-0"
                                >
                                    <div className="flex items-center gap-3 min-w-0 w-full">
                                        <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center shrink-0">
                                            <Link2 className="w-4 h-4 text-sky-600" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="text-sm font-medium text-sky-600 truncate">{shortUrl}</div>
                                            <div className="text-xs text-gray-500 break-all sm:truncate">{link.originalUrl}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 text-sm text-gray-500 w-full sm:w-auto sm:justify-end">
                                        <span className="flex items-center gap-1">
                                            <MousePointer className="w-3.5 h-3.5" />
                                            {link._count.clicks}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                link.isActive
                                                    ? 'bg-sky-100 text-sky-700'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {link.isActive ? 'Hoạt động' : 'Tắt'}
                                        </span>
                                        <span className="text-xs hidden sm:block">
                                            {formatDateTimeVN(link.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
