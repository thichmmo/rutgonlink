'use client'

import {useState, useEffect} from 'react'
import {Button} from 'antd'
import {Plus, Trash2, Edit2, ChevronUp, ChevronDown, FolderOpen, CheckCircle2, Layers} from 'lucide-react'
import Link from 'next/link'

interface Folder {
  id: string
  name: string
  urls: string
  order: number
  folderGroupId: string | null
  createdAt: string
}

interface FolderGroup {
  id: string
  name: string
}

interface ActiveFolderPreview {
  groupId: string
  groupName: string
  totalFolders: number
  rotatingLinkCount: number
  activeFolderId: string | null
  activeFolderName: string | null
  activeIndex: number | null
  activeLinkCount: number
}

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrls, setEditUrls] = useState('')
  const [editGroupId, setEditGroupId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrls, setNewUrls] = useState('')
  const [newGroupId, setNewGroupId] = useState<string>('')
  const [error, setError] = useState('')
  const [dayOffset, setDayOffset] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [enablingAll, setEnablingAll] = useState(false)
  const [activePreviews, setActivePreviews] = useState<ActiveFolderPreview[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFolders()
    loadFolderGroups()
    loadActivePreviews(0)
  }, [])

  useEffect(() => {
    loadActivePreviews(dayOffset)
  }, [dayOffset])

  const loadActivePreviews = async (offset: number) => {
    try {
      const res = await fetch(`/api/folders/active-preview?dayOffset=${offset}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setActivePreviews(data.data ?? [])
      }
    } catch {
      // Ignore
    }
  }

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

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/folders')
      if (res.ok) {
        const data = await res.json()
        setFolders(data)
      }
    } catch {
      setError('Không thể tải folders')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newUrls.trim()) {
      setError('Vui lòng nhập tên và URLs')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: newName.trim(),
          urls: newUrls,
          folderGroupId: newGroupId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setNewName('')
      setNewUrls('')
      setNewGroupId('')
      setCreating(false)
      await loadFolders()
      await loadActivePreviews(dayOffset)
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (folderId: string) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: editName.trim(),
          urls: editUrls,
          folderGroupId: editGroupId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setEditingId(null)
      await loadFolders()
      await loadActivePreviews(dayOffset)
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (folderId: string) => {
    if (!confirm('Xóa folder này? Các link đang dùng folder này sẽ không còn sử dụng nó nữa.')) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      await loadFolders()
      await loadActivePreviews(dayOffset)
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleMove = async (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = folders.findIndex(f => f.id === folderId)
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === folders.length - 1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const newOrder = [...folders]
    const [moved] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/folders/reorder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({folderIds: newOrder.map(f => f.id)}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      loadFolders()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleAdvanceRotation = async () => {
    if (!confirm('Chuyển TẤT CẢ link sang folder tiếp theo? Thao tác này sẽ ảnh hưởng đến tất cả link đang dùng folder rotation.')) {
      return
    }

    setAdvancing(true)
    setError('')

    try {
      const res = await fetch('/api/folders/advance-rotation', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      alert(data.message || 'Đã chuyển folder thành công')
      setDayOffset(0)
      window.location.reload()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setAdvancing(false)
    }
  }

  const handleEnableAllRotation = async () => {
    if (!confirm('Bật folder rotation cho TẤT CẢ link của bạn? Các link sẽ bắt đầu luân phiên folder từ hôm nay.')) {
      return
    }

    setEnablingAll(true)
    setError('')

    try {
      const res = await fetch('/api/folders/enable-all-rotation', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      alert(data.message || 'Đã bật folder rotation thành công')
      window.location.reload()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setEnablingAll(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const groupedFolders = folderGroups.map(group => ({
    group,
    folders: folders.filter(f => f.folderGroupId === group.id)
  }))
  const ungroupedFolders = folders.filter(f => !f.folderGroupId)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Folders</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tạo và quản lý folders chứa URLs. Sau đó gán folders vào các link để sử dụng chế độ luân phiên.
            </p>
          </div>
          <Link href="/dashboard/folder-groups">
            <Button icon={<Layers className="w-4 h-4" />} type="default">
              Quản lý Folder Groups
            </Button>
          </Link>
        </div>
      </div>

      {/* Active folder preview */}
      {folderGroups.length > 0 && (
        <div className="mb-4 bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-sky-600" />
              <span className="text-sm font-medium text-sky-900">
                {dayOffset === 0 ? 'Folder active hôm nay:' : `Folder active sau ${dayOffset} ngày:`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="small"
                onClick={() => setDayOffset(dayOffset + 1)}
              >
                Ngày tiếp theo
              </Button>
              {dayOffset > 0 && (
                <Button
                  size="small"
                  onClick={() => setDayOffset(0)}
                >
                  Reset
                </Button>
              )}
              <Button
                size="small"
                type="primary"
                loading={enablingAll}
                onClick={handleEnableAllRotation}
              >
                Bật rotation cho tất cả link
              </Button>
              <Button
                size="small"
                type="primary"
                danger
                loading={advancing}
                onClick={handleAdvanceRotation}
              >
                Chuyển folder ngay
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {groupedFolders.map(({ group, folders: groupFolders }) => {
              if (groupFolders.length === 0) return null
              const preview = activePreviews.find(item => item.groupId === group.id)
              const activeIndex = preview?.activeIndex ?? null
              return (
                <div key={group.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-indigo-700">{group.name}:</span>
                  <span className="text-xs font-semibold text-sky-700 bg-white/70 border border-sky-200 rounded px-2 py-0.5">
                    {activeIndex !== null ? `#${activeIndex + 1}/${groupFolders.length}` : `-/${groupFolders.length}`}
                  </span>
                  <span className="text-lg font-bold text-sky-600">{preview?.activeFolderName || 'N/A'}</span>
                  {preview && preview.rotatingLinkCount > 0 && (
                    <span className="text-xs text-sky-600">
                      ({preview.activeLinkCount}/{preview.rotatingLinkCount} link)
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-sky-700 mt-3">
            {dayOffset === 0
              ? 'Mỗi folder group có rotation riêng. Link sẽ dùng folder active của group tương ứng.'
              : `Sau ${dayOffset} ngày, mỗi group sẽ chuyển sang folder tiếp theo.`
            }
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Folder Groups */}
        {groupedFolders.map(({ group, folders: groupFolders }) => (
          <div key={group.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-indigo-600" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="text-sm text-gray-500">{groupFolders.length} folders</p>
                </div>
              </div>
              {expandedGroups.has(group.id) ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedGroups.has(group.id) && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {groupFolders.map((folder) => {
                  const urlCount = folder.urls.split('\n').filter(Boolean).length
                  const isEditing = editingId === folder.id

                  return (
                    <div key={folder.id} className="p-4 bg-gray-50/50">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Tên folder"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                          <textarea
                            value={editUrls}
                            onChange={(e) => setEditUrls(e.target.value)}
                            rows={6}
                            placeholder="Mỗi dòng 1 URL"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
                          />
                          {folderGroups.length > 0 && (
                            <select
                              value={editGroupId}
                              onChange={(e) => setEditGroupId(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                              <option value="">-- Không thuộc group nào --</option>
                              {folderGroups.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          )}
                          <div className="flex gap-2">
                            <Button size="small" type="primary" loading={loading} onClick={() => handleUpdate(folder.id)}>
                              Lưu
                            </Button>
                            <Button size="small" onClick={() => setEditingId(null)} disabled={loading}>
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-sky-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{folder.name}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{urlCount} URLs</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingId(folder.id)
                                setEditName(folder.name)
                                setEditUrls(folder.urls)
                                setEditGroupId(folder.folderGroupId || '')
                              }}
                              disabled={loading}
                              className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(folder.id)}
                              disabled={loading}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* Ungrouped Folders */}
        {ungroupedFolders.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-500 px-1">Folders không thuộc group</p>
            {ungroupedFolders.map((folder) => {
              const urlCount = folder.urls.split('\n').filter(Boolean).length
              const isEditing = editingId === folder.id

              return (
                <div key={folder.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Tên folder"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <textarea
                        value={editUrls}
                        onChange={(e) => setEditUrls(e.target.value)}
                        rows={6}
                        placeholder="Mỗi dòng 1 URL"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
                      />
                      {folderGroups.length > 0 && (
                        <select
                          value={editGroupId}
                          onChange={(e) => setEditGroupId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                        >
                          <option value="">-- Không thuộc group nào --</option>
                          {folderGroups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <Button size="small" type="primary" loading={loading} onClick={() => handleUpdate(folder.id)}>
                          Lưu
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)} disabled={loading}>
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-5 h-5 text-sky-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{folder.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{urlCount} URLs</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(folder.id)
                            setEditName(folder.name)
                            setEditUrls(folder.urls)
                            setEditGroupId(folder.folderGroupId || '')
                          }}
                          disabled={loading}
                          className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(folder.id)}
                          disabled={loading}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {creating ? (
        <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên folder (VD: Folder 1)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <textarea
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            rows={6}
            placeholder={'https://example.com/link-1\nhttps://example.com/link-2\nhttps://example.com/link-3'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
          />
          {folderGroups.length > 0 && (
            <select
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
            >
              <option value="">-- Không thuộc group nào --</option>
              {folderGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle2 className="w-4 h-4" />}
              loading={loading}
              onClick={handleCreate}
            >
              Tạo folder
            </Button>
            <Button
              size="small"
              onClick={() => {
                setCreating(false)
                setNewName('')
                setNewUrls('')
                setError('')
              }}
              disabled={loading}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="dashed"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreating(true)}
          className="w-full mt-4"
          disabled={loading}
        >
          Thêm folder mới
        </Button>
      )}
    </div>
  )
}
