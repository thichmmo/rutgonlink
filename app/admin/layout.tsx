import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth-options';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {LayoutDashboard, Users, Activity, CreditCard, Globe, KeyRound, Film} from 'lucide-react';
import AdminSignOut from './AdminSignOut';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

const navItems = [
    {href: '/admin', label: 'Tổng quan', icon: LayoutDashboard},
    {href: '/admin/users', label: 'Người dùng', icon: Users},
    {href: '/admin/traffic', label: 'Traffic', icon: Activity},
    {href: '/admin/transactions', label: 'Giao dịch', icon: CreditCard},
    {href: '/admin/logs', label: 'Request Logs', icon: Globe},
    {href: '/admin/facebook-token', label: 'Facebook Token', icon: KeyRound},
    {href: '/admin/phim', label: 'Web Phim', icon: Film},
];

export default async function AdminLayout({children}: {children: React.ReactNode}) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
        notFound();
    }

    return (
        <div className="h-screen bg-gray-950 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full z-20">
                <div className="p-5 border-b border-gray-800">
                    <Link
                        href="/admin"
                        className="flex items-center gap-2.5 text-white font-bold text-lg"
                    >
                        <span className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                            A
                        </span>
                        Admin Panel
                    </Link>
                </div>

                <nav className="flex-1 p-3 space-y-0.5">
                    {navItems.map(({href, label, icon: Icon}) => (
                        <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm font-medium"
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                            A
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white">Admin</div>
                            <div className="text-xs text-gray-500 truncate">{session.user.email}</div>
                        </div>
                        <AdminSignOut />
                    </div>
                    <Link
                        href="/dashboard"
                        className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
                    >
                        ← Vào Dashboard
                    </Link>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 ml-56 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-gray-900 border-b border-gray-800 px-8 py-3 flex items-center gap-3 sticky top-0 z-10">
                    <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs font-bold rounded-full border border-red-600/30">
                        ADMIN
                    </span>
                    <span className="text-gray-500 text-sm">Quản trị hệ thống · LinkShort</span>
                </header>
                <main className="flex-1 overflow-y-auto p-8 bg-gray-950">{children}</main>
            </div>
        </div>
    );
}
