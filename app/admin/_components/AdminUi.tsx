'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'

const BADGE_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  matched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  manually_matched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  suspended: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  disabled: 'bg-red-500/15 text-red-300 border-red-500/20',
  deleted: 'bg-red-500/15 text-red-300 border-red-500/20',
  failed: 'bg-red-500/15 text-red-300 border-red-500/20',
  error: 'bg-red-500/15 text-red-300 border-red-500/20',
  cancelled: 'bg-gray-500/15 text-gray-300 border-gray-500/20',
  free: 'bg-gray-500/15 text-gray-300 border-gray-500/20',
  pro: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  ultra: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  ultra_plus: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
}

export function AdminBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[value] || BADGE_STYLES.cancelled}`}>
      {label || value}
    </span>
  )
}

export function AdminLoading() {
  return (
    <div className="flex min-h-52 items-center justify-center text-gray-500">
      <Loader2 className="h-7 w-7 animate-spin" />
    </div>
  )
}

export function AdminEmpty({ children = 'Không có dữ liệu' }: { children?: ReactNode }) {
  return <div className="py-12 text-center text-sm text-gray-500">{children}</div>
}

export function AdminPagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3 text-sm text-gray-400">
      <span>Trang {page}/{pages}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function AdminDialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
