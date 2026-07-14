'use client'

import {useState, useEffect} from 'react'
import {FolderOpen, Loader2} from 'lucide-react'

export default function FolderRotationSection() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{text: string; type: 'success' | 'error'} | null>(null)

  useEffect(() => {
    fetch('/api/settings/folder-rotation')
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled || false)
      })
      .catch(() => {
        setMessage({text: 'Không thể tải cài đặt', type: 'error'})
      })
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/folder-rotation', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enabled: !enabled}),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({text: data.error || 'Đã xảy ra lỗi', type: 'error'})
        return
      }

      const data = await res.json()
      setEnabled(data.enabled)
      setMessage({
        text: data.enabled
          ? 'Đã bật folder rotation mặc định cho link mới'
          : 'Đã tắt folder rotation mặc định',
        type: 'success',
      })

      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({text: 'Không thể kết nối server', type: 'error'})
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
        <FolderOpen className="w-5 h-5 text-indigo-600" />
        Folder Rotation
      </h2>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              enabled ? 'bg-indigo-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Bật folder rotation mặc định cho link mới
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Khi bật, tất cả link mới sẽ có chế độ folder rotation được bật sẵn. Bạn vẫn có thể tắt cho từng link riêng lẻ.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`text-xs px-3 py-2 rounded-lg ${
              message.type === 'success'
                ? 'bg-sky-50 text-sky-700 border border-sky-100'
                : 'bg-red-50 text-red-700 border border-red-100'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Folder Rotation là gì?</p>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
            <li>Chia URLs thành nhiều folder, mỗi folder active 1 ngày (00:00-23:59 VN)</li>
            <li>Hệ thống tự động luân phiên folder theo thứ tự mỗi ngày</li>
            <li>Trong 1 ngày, chỉ random link trong folder active</li>
            <li>Phù hợp cho chiến dịch marketing cần thay đổi nội dung theo ngày</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
