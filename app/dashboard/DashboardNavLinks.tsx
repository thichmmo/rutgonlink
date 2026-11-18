'use client'

import { useEffect, useState } from 'react'
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
  Music2,
  PanelsTopLeft,
  FileText,
} from 'lucide-react'
import {
  DASHBOARD_NAV_EVENT,
  defaultDashboardNavVisibility,
  isDashboardHrefVisible,
  normalizeDashboardNavVisibility,
  type DashboardNavVisibility,
} from '@/lib/dashboard-nav-visibility'

const navItems = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/dashboard/links', label: 'Links', icon: Link2 },
  { href: '/dashboard/folders', label: 'Folders', icon: FolderOpen },
  { href: '/dashboard/analytics', label: 'Thống kê', icon: BarChart2 },
  { href: '/dashboard/notes', label: 'Ghi chú', icon: NotebookPen },
  { href: '/dashboard/fb-debug', label: 'FB Debug', icon: Share2 },
  { href: '/dashboard/tiktok-link', label: 'TikTok AFF', icon: Music2 },
  { href: '/dashboard/popups', label: 'Popups', icon: PanelsTopLeft },
  { href: '/dashboard/posts', label: 'Bài viết', icon: FileText },
  { href: '/dashboard/settings', label: 'Cài đặt', icon: Settings },
]

export default function DashboardNavLinks({
  isAdmin,
  initialVisibility,
}: {
  isAdmin: boolean
  initialVisibility?: DashboardNavVisibility
}) {
  const pathname = usePathname()
  const [override, setOverride] = useState<DashboardNavVisibility | null>(null)
  const visibility = override ?? initialVisibility ?? defaultDashboardNavVisibility()

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const custom = event as CustomEvent<DashboardNavVisibility>
      setOverride(normalizeDashboardNavVisibility(custom.detail))
    }
    window.addEventListener(DASHBOARD_NAV_EVENT, onUpdate)
    return () => window.removeEventListener(DASHBOARD_NAV_EVENT, onUpdate)
  }, [])

  const filteredItems = navItems.filter((item) => isDashboardHrefVisible(item.href, visibility))
  const visibleItems = isAdmin
    ? [...filteredItems, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : filteredItems

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
