'use client'

import { useState } from 'react'
import { X, CheckCircle2, Zap, Mail } from 'lucide-react'

const PRO_FEATURES = [
  'Custom domains không giới hạn',
  'Thống kê chi tiết lưu trữ 1 năm',
  'Bảo vệ link bằng mật khẩu',
  'Chuyển hướng theo thiết bị & quốc gia',
  'UTM tracking tự động',
  'QR Code chất lượng cao',
  'Workspace & cộng tác nhóm',
  'Link-in-Bio tùy chỉnh nâng cao',
  'Hỗ trợ ưu tiên 24/7',
]

export default function ProPlanModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
      >
        Xem gói Pro
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-sky-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Gói Pro</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Nâng cấp lên <strong>Pro</strong> để mở khóa toàn bộ tính năng cao cấp:
              </p>

              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <p className="text-sm font-medium text-sky-900 mb-1">Liên hệ để nâng cấp</p>
                <p className="text-xs text-sky-700">
                  Vui lòng liên hệ qua email hoặc nhắn tin để được tư vấn gói Pro phù hợp với nhu cầu của bạn.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer font-medium"
              >
                Để sau
              </button>
                <a
                  href="/support"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <Mail className="w-4 h-4" />
                Liên hệ ngay
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
