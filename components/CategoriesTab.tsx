'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Pencil, Check, X, FolderOpen, MousePointer, TrendingUp, ArrowUpDown, ExternalLink, Layers, Power, PowerOff, Loader2, AlertTriangle } from 'lucide-react'

const PRESET_COLORS = [
  '#6366f1', '#2563eb', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#7c3aed',
]

interface Category {
  id: string
  name: string
  color: string
  folderGroupId?: string | null
  folderGroup?: { id: string; name: string } | null
  _count: { links: number }
  totalClicks: number
  activeLinks: number
}

interface FolderGroup {
  id: string
  name: string
}

interface Props {
  categories: Category[]
  onChange: () => void
  onViewLinks?: (categoryId: string) => void
}

type SortKey = 'name' | 'links' | 'clicks' | 'active'
type DeleteCategoryAction = 'category' | 'category-links'

export default function CategoriesTab({ categories, onChange, onViewLinks }: Props) {
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [newGroupId, setNewGroupId] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editGroupId, setEditGroupId] = useState('')
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('links')
  const [sortAsc, setSortAsc] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [deleteCategoryAction, setDeleteCategoryAction] = useState<DeleteCategoryAction | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null)

  useEffect(() => {
    loadFolderGroups()
  }, [])

  const loadFolderGroups = async () => {
    try {
      const res = await fetch('/api/folder-groups')
      if (res.ok) {
        const data = await res.json()
        setFolderGroups(data)
      }
    } catch {
      // Ignore
    }
  }

  const handleAutoAssign = async () => {
    if (!confirm('Tự động gán folder group cho các categories dựa trên folders mà links đang dùng?')) return
    setAutoAssigning(true)
    setError('')
    try {
      const res = await fetch('/api/categories/auto-assign-groups', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Đã gán thành công')
        onChange()
      } else {
        setError(data.error || 'Đã xảy ra lỗi')
      }
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setAutoAssigning(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        color: newColor,
        folderGroupId: newGroupId || null,
      }),
    })
    setCreating(false)
    if (res.ok) {
      setNewName('')
      setNewGroupId('')
      onChange()
    } else {
      const d = await res.json()
      setError(d.error || 'Lỗi tạo danh mục')
    }
  }

  const handleDeleteCategory = async (cat: Category, deleteLinks: boolean) => {
    setDeletingCategoryId(cat.id)
    setDeleteCategoryAction(deleteLinks ? 'category-links' : 'category')
    setError('')
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteLinks }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'Không thể xóa danh mục')
        return
      }
      setDeleteCategoryTarget(null)
      onChange()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setDeletingCategoryId(null)
      setDeleteCategoryAction(null)
    }
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setEditGroupId(cat.folderGroupId || '')
  }

  const handleSaveEdit = async (id: string) => {
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        color: editColor,
        folderGroupId: editGroupId || null,
      }),
    })
    setEditingId(null)
    onChange()
  }

  const handleToggleCategoryLinks = async (cat: Category) => {
    if (cat._count.links === 0) return

    const nextActive = cat.activeLinks === 0
    const actionLabel = nextActive ? 'bat' : 'tat'
    const confirmMessage = nextActive
      ? `Bat lai tat ca ${cat._count.links} link trong danh muc "${cat.name}"?`
      : `Tat tat ca ${cat.activeLinks}/${cat._count.links} link active trong danh muc "${cat.name}"?`
    if (!confirm(confirmMessage)) return

    setTogglingCategoryId(cat.id)
    setError('')
    try {
      const res = await fetch(`/api/categories/${cat.id}/links-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Khong the ${actionLabel} links trong danh muc`)
        return
      }
      onChange()
    } catch {
      setError('Khong the ket noi server')
    } finally {
      setTogglingCategoryId(null)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = useMemo(() => {
    const arr = [...categories]
    arr.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name') diff = a.name.localeCompare(b.name)
      else if (sortKey === 'links') diff = a._count.links - b._count.links
      else if (sortKey === 'clicks') diff = a.totalClicks - b.totalClicks
      else if (sortKey === 'active') diff = a.activeLinks - b.activeLinks
      return sortAsc ? diff : -diff
    })
    return arr
  }, [categories, sortKey, sortAsc])

  const maxClicks = Math.max(...categories.map(c => c.totalClicks), 1)
  const totalLinks = categories.reduce((s, c) => s + c._count.links, 0)
  const totalClicks = categories.reduce((s, c) => s + c.totalClicks, 0)
  const totalActive = categories.reduce((s, c) => s + c.activeLinks, 0)
  const deleteTargetLinkCount = deleteCategoryTarget?._count.links ?? 0

  const renderSortButton = (k: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(k)}
      className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
        sortKey === k ? 'bg-sky-100 text-sky-700' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Danh mục</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalLinks}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Links <span className="text-sky-600 font-medium">({totalActive} active)</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">Tổng clicks</div>
          </div>
        </div>
      )}

      {folderGroups.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">
                Tự động gán Folder Groups cho categories
              </span>
            </div>
            <button
              onClick={handleAutoAssign}
              disabled={autoAssigning}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {autoAssigning ? 'Đang xử lý...' : 'Tự động gán'}
            </button>
          </div>
          <p className="text-xs text-indigo-700 mt-2">
            Hệ thống sẽ phân tích folders mà links trong mỗi category đang dùng và tự động gán folder group phù hợp.
          </p>
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Tạo danh mục mới</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tên danh mục</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="VD: Marketing, Blog, Affiliate..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Màu</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? '#1e40af' : 'transparent',
                    transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          {folderGroups.length > 0 && (
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Folder Group</label>
              <select
                value={newGroupId}
                onChange={e => setNewGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
              >
                <option value="">-- Không liên kết --</option>
                {folderGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tạo
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Chưa có danh mục nào</p>
          </div>
        ) : (
          <>
            {/* Sort bar */}
            <div className="flex items-center gap-1 px-4 sm:px-5 py-3 border-b border-gray-50 bg-gray-50/60 overflow-x-auto">
              <span className="text-xs text-gray-400 mr-1">Sắp xếp:</span>
              {renderSortButton('links', 'Links')}
              {renderSortButton('clicks', 'Clicks')}
              {renderSortButton('active', 'Active')}
              {renderSortButton('name', 'Tên')}
            </div>

            <div className="divide-y divide-gray-50">
              {sorted.map(cat => (
                <div key={cat.id} className="px-4 sm:px-5 py-4">
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex gap-1">
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setEditColor(c)}
                            className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
                            style={{ backgroundColor: c, borderColor: editColor === c ? '#1e40af' : 'transparent' }}
                          />
                        ))}
                      </div>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit(cat.id)}
                        autoFocus
                        className="flex-1 min-w-32 px-3 py-1.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      {folderGroups.length > 0 && (
                        <select
                          value={editGroupId}
                          onChange={e => setEditGroupId(e.target.value)}
                          className="px-3 py-1.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                        >
                          <option value="">-- Không liên kết --</option>
                          {folderGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => handleSaveEdit(cat.id)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg cursor-pointer">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 min-w-0">
                      {/* Top row: color, name, badges, actions */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 break-words">{cat.name}</span>

                        {/* Stats badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {cat.folderGroup && (
                            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                              <Layers className="w-3 h-3" />
                              {cat.folderGroup.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            <FolderOpen className="w-3 h-3" />
                            {cat._count.links}
                          </span>
                          <span className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            {cat.activeLinks} active
                          </span>
                          <span className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                            <MousePointer className="w-3 h-3" />
                            {cat.totalClicks.toLocaleString()}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                          {onViewLinks && cat._count.links > 0 && (
                            <button
                              onClick={() => onViewLinks(cat.id)}
                              title="Xem links của danh mục này"
                              className="flex items-center gap-1 px-2 py-1.5 text-xs text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer font-medium"
                            >
                              Xem links
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleCategoryLinks(cat)}
                            disabled={cat._count.links === 0 || togglingCategoryId !== null}
                            title={cat.activeLinks > 0 ? 'Tat tat ca link trong danh muc' : 'Bat tat ca link trong danh muc'}
                            aria-label={cat.activeLinks > 0 ? 'Tat tat ca link trong danh muc' : 'Bat tat ca link trong danh muc'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              cat.activeLinks > 0
                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {togglingCategoryId === cat.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : cat.activeLinks > 0 ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              // Keep cancel separate from the two delete choices in the modal.
                              setDeleteCategoryTarget(cat)
                              setError('')
                            }}
                            disabled={deletingCategoryId !== null}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deletingCategoryId === cat.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Progress bars */}
                      {cat._count.links > 0 && (
                        <div className="space-y-1.5 sm:pl-6">
                          {/* Active ratio bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 w-14 shrink-0">Active</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-sky-400 transition-all"
                                style={{ width: `${(cat.activeLinks / cat._count.links) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 w-10 text-right shrink-0">
                              {Math.round((cat.activeLinks / cat._count.links) * 100)}%
                            </span>
                          </div>
                          {/* Click volume bar (relative to max category) */}
                          {totalClicks > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-14 shrink-0 flex items-center gap-0.5">
                                <TrendingUp className="w-2.5 h-2.5" />
                                Clicks
                              </span>
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{
                                    width: `${(cat.totalClicks / maxClicks) * 100}%`,
                                    backgroundColor: cat.color,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 w-10 text-right shrink-0">
                                {totalClicks > 0 ? Math.round((cat.totalClicks / totalClicks) * 100) : 0}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {deleteCategoryTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-category-title"
          onClick={() => {
            if (!deletingCategoryId) setDeleteCategoryTarget(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-category-title" className="text-base font-semibold text-gray-900">
                  Xóa danh mục?
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {deleteTargetLinkCount > 0
                    ? `Danh mục "${deleteCategoryTarget.name}" đang có ${deleteTargetLinkCount} link.`
                    : `Danh mục "${deleteCategoryTarget.name}" hiện không có link.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteCategoryTarget(null)}
                disabled={deletingCategoryId !== null}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Hủy xóa danh mục"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              {deleteTargetLinkCount > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(deleteCategoryTarget, false)}
                    disabled={deletingCategoryId !== null}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteCategoryAction === 'category' ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gray-500" />
                    ) : (
                      <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    )}
                    <span>
                      <span className="block text-sm font-medium text-gray-900">Chỉ xóa danh mục</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Giữ lại {deleteTargetLinkCount} link và bỏ gán khỏi danh mục này.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(deleteCategoryTarget, true)}
                    disabled={deletingCategoryId !== null}
                    className="flex w-full items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteCategoryAction === 'category-links' ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-red-600" />
                    ) : (
                      <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <span>
                      <span className="block text-sm font-semibold text-red-700">Xóa danh mục và link</span>
                      <span className="mt-0.5 block text-xs text-red-600">
                        Xóa vĩnh viễn {deleteTargetLinkCount} link trong danh mục này.
                      </span>
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(deleteCategoryTarget, false)}
                  disabled={deletingCategoryId !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteCategoryAction === 'category' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Xóa danh mục
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setDeleteCategoryTarget(null)}
                disabled={deletingCategoryId !== null}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
