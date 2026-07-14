'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Menu, X, Link2, LayoutDashboard, BarChart2, NotebookPen, Settings, LogOut, Share2,
} from 'lucide-react'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/dashboard/links', label: 'Links', icon: Link2 },
  { href: '/dashboard/analytics', label: 'Thống kê', icon: BarChart2 },
  { href: '/dashboard/notes', label: 'Ghi chú', icon: NotebookPen },
  { href: '/dashboard/fb-debug', label: 'FB Debug', icon: Share2 },
  { href: '/dashboard/settings', label: 'Cài đặt', icon: Settings },
]

interface Props {
  userName: string
  userEmail: string
  userInitial: string
}

export default function MobileNav({ userName, userEmail, userInitial }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => {
    queueMicrotask(() => setOpen(false))
  }, [pathname])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <>
      {/* Hamburger button — shown on mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
        aria-label="Mở menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-2rem))] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-sky-600">
            <Image src="/logo_v_transparent.png" alt="LinkShort" width={32} height={32} className="object-contain" />
            LinkShort
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-sky-50 text-sky-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{userName}</div>
              <div className="text-xs text-gray-500 truncate">{userEmail}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Bottom Tab Bar — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex lg:hidden pb-[env(safe-area-inset-bottom)]">
        {[
          { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { href: '/dashboard/links', label: 'Links', icon: Link2 },
          { href: '/dashboard/analytics', label: 'Thống kê', icon: BarChart2 },
          { href: '/dashboard/fb-debug', label: 'FB Debug', icon: Share2 },
          { href: '/dashboard/settings', label: 'Cài đặt', icon: Settings },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors ${
              isActive(item.href) ? 'text-sky-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <item.icon className={`w-5 h-5 ${isActive(item.href) ? 'text-sky-600' : 'text-gray-400'}`} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
