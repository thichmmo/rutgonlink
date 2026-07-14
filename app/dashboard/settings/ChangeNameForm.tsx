'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialName: string
}

export default function ChangeNameForm({ initialName }: Props) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const res = await fetch('/api/user/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Có lỗi xảy ra')
    } else {
      setSuccess(true)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setSuccess(false) }}
          maxLength={50}
          required
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        {success && <p className="text-xs text-sky-600 mt-1">Cập nhật thành công!</p>}
      </div>
      <button
        type="submit"
        disabled={loading || name.trim() === initialName}
        className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer whitespace-nowrap"
      >
        {loading ? 'Đang lưu...' : 'Lưu'}
      </button>
    </form>
  )
}
