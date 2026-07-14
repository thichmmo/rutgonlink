import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth-options';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import DashboardSignOut from './DashboardSignOut';
import MobileNav from './MobileNav';
import DashboardNavLinks from './DashboardNavLinks';
import CreateLinkButton from './CreateLinkButton';
import DashboardClock from './DashboardClock';

export default async function DashboardLayout({children}: {children: React.ReactNode}) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.status !== 'active') {
        redirect('/login');
    }

    const userName = session.user.name || 'Người dùng';
    const userEmail = session.user.email || '';
    const userInitial = (session.user.name?.[0] || session.user.email?.[0] || 'U').toUpperCase();
    const isAdmin = Boolean(session.user.isAdmin);

    return (
        <div className="h-dvh bg-gray-50 flex overflow-hidden">
            {/* Desktop Sidebar — hidden on mobile */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col fixed h-full z-20">
                {/* Logo */}
                <div className="p-6 border-b border-gray-100">
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 text-xl font-bold text-sky-600"
                    >
                        <Image
                            src="/logo_v_transparent.png"
                            alt="LinkShort"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                        LinkShort
                    </Link>
                </div>

                <DashboardNavLinks isAdmin={isAdmin} />

                {/* User */}
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {userInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{userName}</div>
                            <div className="text-xs text-gray-500 truncate">{userEmail}</div>
                        </div>
                        <DashboardSignOut />
                    </div>

                </div>

            </aside>

            {/* Main content */}
            <div className="flex-1 lg:ml-64 flex flex-col min-w-0 overflow-hidden">
                {/* Top header */}
                <header className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between gap-3 sticky top-0 z-10">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Mobile: logo + hamburger */}
                        <MobileNav
                            userName={userName}
                            userEmail={userEmail}
                            userInitial={userInitial}
                            isAdmin={isAdmin}
                        />
                        {/* Mobile: show logo in header */}
                        <Link
                            href="/"
                            className="lg:hidden flex items-center gap-2 text-base sm:text-lg font-bold text-sky-600 min-w-0"
                        >
                            <Image
                                src="/logo_v_transparent.png"
                                alt="LinkShort"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <span className="truncate">LinkShort</span>
                        </Link>
                        {/* Desktop: greeting */}
                        <div className="hidden lg:block text-sm text-gray-500">
                            Xin chào, <span className="font-medium text-gray-900">{userName}</span>
                        </div>
                    </div>
                    <DashboardClock />
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <CreateLinkButton />
                    </div>
                </header>

                {/* Page content — extra bottom padding for mobile tab bar */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-8 pb-24 lg:pb-8 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
