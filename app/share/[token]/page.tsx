'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { Lock, FileText } from 'lucide-react'
import { parseNoteContent } from '@/lib/note-content'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import Link from 'next/link'

interface NoteData {
  title: string
  content?: string
  hasPassword: boolean
  ownerName: string | null
  updatedAt: string
}

export default function PublicNotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [data, setData] = useState<NoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [content, setContent] = useState('')

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        if (!d.hasPassword && d.content !== undefined) {
          setContent(d.content)
          setUnlocked(true)
        }
        setLoading(false)
      })
      .catch(() => { setError('Đã xảy ra lỗi'); setLoading(false) })
  }, [token])

  const handleUnlock = async () => {
    if (!password.trim()) return
    setUnlocking(true)
    setPwError('')
    const res = await fetch(`/api/share/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const d = await res.json()
    if (!res.ok) {
      setPwError(d.error || 'Mật khẩu không đúng')
      setUnlocking(false)
      return
    }
    setContent(d.content)
    setUnlocked(true)
    setUnlocking(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-blue-600">
          <Image src="/logo_v_transparent.png" alt="LinkShort" width={28} height={28} className="object-contain" />
          LinkShort
        </Link>
        <span className="text-xs text-gray-400">Ghi chú được chia sẻ</span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 sm:px-8 pt-10 pb-10">
        {loading ? (
          <div className="text-gray-400 text-sm">Đang tải...</div>
        ) : error ? (
          <div className="text-center">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl lg:max-w-[70%]">
            {/* Note card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Note header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900">{data!.title}</h1>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  {data!.ownerName && <span>bởi {data!.ownerName}</span>}
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(data!.updatedAt), { addSuffix: true, locale: vi })}</span>
                </div>
              </div>

              {/* Password gate */}
              {!unlocked ? (
                <div className="px-6 py-10 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <Lock className="w-7 h-7 text-amber-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Ghi chú này được bảo vệ bằng mật khẩu</p>
                    <p className="text-xs text-gray-400 mt-1">Nhập mật khẩu để xem nội dung</p>
                  </div>
                  <div className="w-full max-w-xs flex flex-col gap-2">
                    <input
                      type="password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setPwError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                      placeholder="Nhập mật khẩu..."
                      autoFocus
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                    />
                    {pwError && <p className="text-xs text-red-500 text-center">{pwError}</p>}
                    <button
                      onClick={handleUnlock}
                      disabled={!password.trim() || unlocking}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {unlocking ? 'Đang xác thực...' : 'Xem ghi chú'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Content */
                <div className="px-6 py-5 overflow-x-hidden">
                  {content ? (
                    <div className="space-y-4">
                      {parseNoteContent(content).map((block, i) =>
                        block.type === 'text' ? (
                          <pre key={i} className="whitespace-pre-wrap break-all overflow-x-hidden text-sm text-gray-700 leading-relaxed font-sans w-full">
                            {block.content}
                          </pre>
                        ) : (
                          <div key={i} className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full border-collapse text-sm">
                              <tbody>
                                {block.rows.map((row, ri) => (
                                  <tr key={ri} className={ri === 0 ? 'bg-gray-50 font-medium' : ''}>
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="border border-gray-200 px-3 py-2 text-gray-700">
                                        {cell || <span className="text-gray-300">&nbsp;</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Không có nội dung</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
