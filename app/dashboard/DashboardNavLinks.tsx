'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Link2,
  BarChart2,
  NotebookPen,
  Settings,
  Share2,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/dashboard/links', label: 'Links', icon: Link2 },
  { href: '/dashboard/folders', label: 'Folders', icon: FolderOpen },
  { href: '/dashboard/analytics', label: 'Thống kê', icon: BarChart2 },
  { href: '/dashboard/notes', label: 'Ghi chú', icon: NotebookPen },
  { href: '/dashboard/fb-debug', label: 'FB Debug', icon: Share2 },
  { href: '/dashboard/settings', label: 'Cài đặt', icon: Settings },
]

export default function DashboardNavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const visibleItems = isAdmin
    ? [...navItems, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : navItems

  return (
    <nav className="flex-1 p-4 space-y-1">
      {visibleItems.map((item) => {
        const isActive = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sky-50 text-sky-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-gray-400'}`} />
            {item.label}
            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-600" />}
          </Link>
        )
      })}
    </nav>
  )
}
