'use client'

import {useState} from 'react'
import {Button} from 'antd'
import {Plus, Trash2, Edit2, ChevronUp, ChevronDown, FolderOpen, CheckCircle2} from 'lucide-react'

interface Folder {
  id: string
  name: string
  urls: string
  order: number
}

interface Props {
  linkId: string
  folders: Folder[]
  activeFolderIndex?: number | null
  onUpdate: () => void
}

export default function FolderManagementSection({linkId, folders, activeFolderIndex, onUpdate}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrls, setEditUrls] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrls, setNewUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sortedFolders = [...folders].sort((a, b) => a.order - b.order)

  const handleCreate = async () => {
    if (!newName.trim() || !newUrls.trim()) {
      setError('Vui lòng nhập tên và URLs')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/links/${linkId}/folders`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newName.trim(), urls: newUrls}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setNewName('')
      setNewUrls('')
      setCreating(false)
      onUpdate()
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
      const res = await fetch(`/api/links/${linkId}/folders/${folderId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: editName.trim(), urls: editUrls}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      setEditingId(null)
      onUpdate()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (folderId: string) => {
    if (!confirm('Xóa folder này?')) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/links/${linkId}/folders/${folderId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      onUpdate()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleMove = async (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedFolders.findIndex(f => f.id === folderId)
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === sortedFolders.length - 1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const newOrder = [...sortedFolders]
    const [moved] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/links/${linkId}/folders/reorder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({folderIds: newOrder.map(f => f.id)}),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Đã xảy ra lỗi')
        return
      }

      onUpdate()
    } catch {
      setError('Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {/* Folder list */}
      <div className="space-y-2">
        {sortedFolders.map((folder, index) => {
          const urlCount = folder.urls.split('\n').filter(Boolean).length
          const isActive = activeFolderIndex !== null && activeFolderIndex !== undefined && index === activeFolderIndex
          const isEditing = editingId === folder.id

          return (
            <div
              key={folder.id}
              className={`border rounded-xl p-3 ${isActive ? 'border-sky-400 bg-sky-50' : 'border-gray-200 bg-white'}`}
            >
              {isEditing ? (
                <div className="space-y-2">
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
                    rows={4}
                    placeholder="Mỗi dòng 1 URL"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="small"
                      type="primary"
                      loading={loading}
                      onClick={() => handleUpdate(folder.id)}
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
                  <FolderOpen className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{folder.name}</p>
                      {isActive && (
                        <span className="text-xs px-2 py-0.5 bg-sky-600 text-white rounded-full font-medium">
                          Active hôm nay
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{urlCount} URLs</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(folder.id, 'up')}
                      disabled={index === 0 || loading}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển lên"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(folder.id, 'down')}
                      disabled={index === sortedFolders.length - 1 || loading}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển xuống"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(folder.id)
                        setEditName(folder.name)
                        setEditUrls(folder.urls)
                      }}
                      disabled={loading}
                      className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Sửa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(folder.id)}
                      disabled={loading}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Create new folder */}
      {creating ? (
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
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
            rows={4}
            placeholder={'https://example.com/link-1\nhttps://example.com/link-2'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono"
          />
          <div className="flex gap-2">
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
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
          className="w-full"
          disabled={loading}
        >
          Thêm folder mới
        </Button>
      )}
    </div>
  )
}
