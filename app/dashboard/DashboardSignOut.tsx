'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function DashboardSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
      title="Đăng xuất"
    >
      <LogOut className="w-4 h-4" />
    </button>
  )
}
