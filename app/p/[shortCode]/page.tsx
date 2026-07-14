'use client'

import { useState, use } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function PasswordGatePage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = use(params)
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/links/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortCode, password }),
    })

    if (res.ok) {
      // Cookie đã set, giờ redirect về link gốc để route.ts xử lý
      router.push(`/${shortCode}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Mật khẩu không đúng')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 w-fit text-lg font-bold text-blue-600">
          <Image src="/logo_v_transparent.png" alt="LinkShort" width={28} height={28} className="object-contain" />
          LinkShort
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8 flex flex-col items-center gap-5">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>

          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">Link được bảo vệ</h1>
            <p className="text-sm text-gray-500 mt-1">Nhập mật khẩu để tiếp tục truy cập</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Nhập mật khẩu..."
              autoFocus
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
            />
            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={!password.trim() || loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? 'Đang xác thực...' : 'Truy cập'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
