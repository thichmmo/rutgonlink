import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Activity,
  CreditCard,
  ExternalLink,
  Film,
  Gauge,
  Globe2,
  KeyRound,
  Link2,
  ScrollText,
  ServerCog,
  Users,
} from 'lucide-react'
import AdminSignOut from './AdminSignOut'
import { getAdminContext, hasAdminPermission, type AdminPermission } from '@/lib/admin-auth'

const navItems: Array<{
  href: string
  label: string
  icon: typeof Gauge
  permission: AdminPermission
}> = [
  { href: '/admin', label: 'Tổng quan', icon: Gauge, permission: 'overview.read' },
  { href: '/admin/users', label: 'Người dùng', icon: Users, permission: 'users.read' },
  { href: '/admin/links', label: 'Links', icon: Link2, permission: 'links.read' },
  { href: '/admin/domains', label: 'Domains', icon: Globe2, permission: 'domains.read' },
  { href: '/admin/transactions', label: 'Thanh toán', icon: CreditCard, permission: 'billing.read' },
  { href: '/admin/traffic', label: 'Traffic', icon: Activity, permission: 'logs.read' },
  { href: '/admin/logs', label: 'Request Logs', icon: ExternalLink, permission: 'logs.read' },
  { href: '/admin/audit', label: 'Audit Logs', icon: ScrollText, permission: 'logs.read' },
  { href: '/admin/system', label: 'System Health', icon: ServerCog, permission: 'system.read' },
  { href: '/admin/facebook-token', label: 'Facebook Token', icon: KeyRound, permission: 'system.read' },
  { href: '/admin/phim', label: 'Web Phim', icon: Film, permission: 'system.read' },
]

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  support: 'Support',
  finance: 'Finance',
  ops: 'Operations',
  viewer: 'Viewer',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext()
  if (!admin) notFound()

  const visibleItems = navItems.filter((item) => hasAdminPermission(admin, item.permission))

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 lg:flex">
      <aside className="border-b border-gray-800 bg-gray-900 lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 p-5">
            <Link href="/admin" className="flex items-center gap-2.5 text-lg font-bold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-sm">A</span>
              Admin Panel
            </Link>
            <AdminSignOut />
          </div>

          <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
            {visibleItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden border-t border-gray-800 p-4 lg:block">
            <div className="text-sm font-medium text-white">{admin.email}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-red-400">{ROLE_LABEL[admin.role]}</div>
            <Link href="/dashboard" className="mt-3 block text-xs text-gray-500 hover:text-gray-300">
              ← Vào Dashboard
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3 lg:px-8">
          <div>
            <span className="rounded-full border border-red-600/30 bg-red-600/20 px-2 py-0.5 text-xs font-bold text-red-400">ADMIN</span>
            <span className="ml-3 text-sm text-gray-500">Quản trị LinkShort</span>
          </div>
          <span className="text-xs text-gray-500 lg:hidden">{ROLE_LABEL[admin.role]}</span>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
