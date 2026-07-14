'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { data: session, status } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Smooth scroll to #features — works cross-page
  const handleFeaturesClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault()
      const el = document.getElementById('features')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
    setMobileOpen(false)
  }

  const navLinks = [
    { href: '/#features', label: 'Giải pháp', onClick: handleFeaturesClick },
    { href: '/api-docs', label: 'API', onClick: () => setMobileOpen(false) },
    { href: '/blog', label: 'Blog', onClick: () => setMobileOpen(false) },
  ]

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
        scrolled ? 'bg-white shadow-md border-gray-100' : 'bg-white/80 backdrop-blur-sm border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-sky-600">
            <Image src="/logo_v_transparent.png" alt="LinkShort" width={32} height={32} className="object-contain" />
            LinkShort
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={link.onClick}
                className="text-sm font-medium text-gray-600 hover:text-sky-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-all text-sm font-medium text-gray-700 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <span className="max-w-30 truncate">{session.user?.name || session.user?.email}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-xs text-gray-400">Đăng nhập với</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{session.user?.email}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Tài khoản
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/' }) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-sky-600 transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100">
            <div className="pt-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={link.onClick}
                  className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-sky-600 rounded-lg hover:bg-sky-50 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                {session ? (
                  <>
                    <div className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100">
                      {session.user?.name || session.user?.email}
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 bg-sky-600 text-white text-sm font-semibold text-center rounded-xl hover:bg-sky-700 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <button
                      onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/' }) }}
                      className="w-full px-3 py-2 text-sm font-medium text-red-600 text-center border border-red-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors"
                    >
                      Đăng xuất
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-700 text-center border border-gray-200 rounded-xl">
                      Đăng nhập
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2 bg-sky-600 text-white text-sm font-semibold text-center rounded-xl hover:bg-sky-700 transition-colors">
                      Đăng ký
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
