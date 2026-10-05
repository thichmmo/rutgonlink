'use client'

import { useEffect, useState } from 'react'

type BlockSummary = { id: string; title: string; placement: 'before' | 'after'; isActive: boolean }

export default function FixedContentSection({ revision, disabled, onManage }: { revision: number; disabled: boolean; onManage: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [result, setResult] = useState<{ revision: number; blocks: BlockSummary[]; error: string } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/content-blocks', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || !Array.isArray(data)) throw new Error(data?.error || 'Không tải được nội dung cố định')
        if (active) setResult({ revision, blocks: data, error: '' })
      } catch (cause) {
        if (active) setResult({ revision, blocks: [], error: cause instanceof Error ? cause.message : 'Không tải được nội dung cố định' })
      }
    }
    void load()
    // Closing/reopening a draft must not let an older request overwrite its summary.
    return () => { active = false }
  }, [revision])

  const loading = result?.revision !== revision
  const blocks = result?.blocks || []
  const activeBlocks = blocks.filter(block => block.isActive)

  return <section aria-label="Nội dung cố định của bài viết" className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-gray-950">Nội dung cố định</h3><p className="mt-1 text-xs leading-relaxed text-gray-600">Nội dung đang bật được tự động chèn vào đầu/cuối bài này, kể cả bài Telegram. Không cần dán lại vào ô nội dung bài viết.</p></div>
      <button type="button" disabled={disabled} onClick={onManage} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">Thêm / chỉnh nội dung cố định</button>
    </div>
    {loading ? <p role="status" className="mt-3 text-xs text-gray-500">Đang tải nội dung cố định...</p> : result?.error ? <p role="alert" className="mt-3 text-xs text-amber-800">{result.error}. Mở phần chỉnh sửa để thử lại.</p> : <>
      {activeBlocks.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{(['before', 'after'] as const).map(placement => <div key={placement} className="rounded-lg border border-violet-100 bg-white p-3"><p className="text-xs font-semibold text-gray-700">{placement === 'before' ? 'Đầu bài' : 'Cuối bài'}</p><ul className="mt-1 space-y-1 text-sm text-gray-600">{activeBlocks.filter(block => block.placement === placement).map(block => <li key={block.id} className="break-words">{block.title}</li>)}</ul>{!activeBlocks.some(block => block.placement === placement) && <p className="mt-1 text-xs text-gray-400">Chưa có nội dung đang bật.</p>}</div>)}</div> : <p className="mt-3 text-sm text-gray-600">Chưa có nội dung cố định đang bật. Thêm mới hoặc bật nội dung đã lưu để dùng cho bài viết.</p>}
      {blocks.some(block => !block.isActive) && <p className="mt-2 text-xs text-gray-500">{blocks.filter(block => !block.isActive).length} nội dung đang tắt, chưa áp dụng vào bài viết.</p>}
    </>}
    <p className="mt-3 text-xs text-violet-800">Đây là cài đặt dùng chung của tài khoản: thêm, sửa hoặc bật/tắt sẽ áp dụng cho tất cả bài viết. Bản nháp đang soạn được giữ nguyên khi mở phần chỉnh sửa.</p>
  </section>
}
