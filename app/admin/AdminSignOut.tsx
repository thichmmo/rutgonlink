'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function AdminSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer shrink-0"
      title="Đăng xuất"
    >
      <LogOut className="w-4 h-4" />
    </button>
  )
}
