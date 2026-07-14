'use client'

import {useState, useEffect} from 'react'
import {Button} from 'antd'
import {Plus, Trash2, Edit2, ChevronUp, ChevronDown, FolderOpen} from 'lucide-react'

interface FolderGroup {
  id: string
  name: string
  order: number
  createdAt: string
  _count: {
    folders: number
    categories: number
  }
}

export default function FolderGroupsPage() {
  const [groups, setGroups] = useState<FolderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      const res = await fetch('/api/folder-groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data)
      }
    } catch {
      setError('Không thể tải folder groups')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Vui lòng nhập tên')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/folder-groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newName.trim()}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setNewName('')
      setCreating(false)
      loadGroups()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (groupId: string) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/folder-groups/${groupId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: editName.trim()}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setEditingId(null)
      loadGroups()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Xóa folder group này? Các folder và category liên kết sẽ không bị xóa.')) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/folder-groups/${groupId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      loadGroups()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleMove = async (groupId: string, direction: 'up' | 'down') => {
    const currentIndex = groups.findIndex(g => g.id === groupId)
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === groups.length - 1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const newOrder = [...groups]
    const [moved] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/folder-groups/reorder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({groupIds: newOrder.map(g => g.id)}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      loadGroups()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Folder Groups</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tạo folder groups (folder mẹ) để nhóm các folders lại với nhau. Sau đó liên kết với danh mục để tự động gán folders cho link.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group, index) => {
          const isEditing = editingId === group.id

          return (
            <div
              key={group.id}
              className="border border-gray-200 rounded-xl p-4 bg-white"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Tên folder group"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="small"
                      type="primary"
                      loading={loading}
                      onClick={() => handleUpdate(group.id)}
                    >
                      Lưu
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {group._count.folders} folders • {group._count.categories} categories
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(group.id, 'up')}
                      disabled={index === 0 || loading}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển lên"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(group.id, 'down')}
                      disabled={index === groups.length - 1 || loading}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển xuống"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(group.id)
                        setEditName(group.name)
                      }}
                      disabled={loading}
                      className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
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

      {creating ? (
        <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên folder group (VD: Shopee Links, TikTok Links)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <div className="flex gap-2">
            <Button
              size="small"
              type="primary"
              loading={loading}
              onClick={handleCreate}
            >
              Tạo group
            </Button>
            <Button
              size="small"
              onClick={() => {
                setCreating(false)
                setNewName('')
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
          Thêm folder group mới
        </Button>
      )}
    </div>
  )
}
