'use client'

import {useState, useEffect} from 'react'
import {Button, Checkbox} from 'antd'
import {FolderOpen, ChevronUp, ChevronDown} from 'lucide-react'

interface Folder {
  id: string
  name: string
  urls: string
  order: number
}

interface Props {
  linkId: string
  onUpdate: () => void
}

export default function FolderSelectionSection({linkId, onUpdate}: Props) {
  const [allFolders, setAllFolders] = useState<Folder[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFolders()
    loadAssignments()
  }, [linkId])

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/folders')
      if (res.ok) {
        const data = await res.json()
        setAllFolders(data)
      }
    } catch {
      setError('Không thể tải folders')
    }
  }

  const loadAssignments = async () => {
    try {
      const res = await fetch(`/api/links/${linkId}/folders`)
      if (res.ok) {
        const data = await res.json()
        setSelectedIds(data.map((f: Folder) => f.id))
      }
    } catch {
      // Ignore
    }
  }

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      setError('Vui lòng chọn ít nhất 1 folder')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/links/${linkId}/folders`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({folderIds: selectedIds}),
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

  const handleToggle = (folderId: string) => {
    if (selectedIds.includes(folderId)) {
      setSelectedIds(selectedIds.filter(id => id !== folderId))
    } else {
      setSelectedIds([...selectedIds, folderId])
    }
  }

  const handleMove = (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedIds.indexOf(folderId)
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === selectedIds.length - 1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const newOrder = [...selectedIds]
    const [moved] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    setSelectedIds(newOrder)
  }

  const selectedFolders = selectedIds.map(id => allFolders.find(f => f.id === id)).filter(Boolean) as Folder[]

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {allFolders.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
          Chưa có folder nào. <a href="/dashboard/folders" target="_blank" className="text-sky-600 hover:underline">Tạo folder mới</a>
        </div>
      ) : (
        <>
          <div className="text-xs font-medium text-gray-700 mb-2">Chọn folders để sử dụng:</div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {allFolders.map(folder => {
              const urlCount = folder.urls.split('\n').filter(Boolean).length
              const isSelected = selectedIds.includes(folder.id)

              return (
                <label
                  key={folder.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'border-sky-400 bg-sky-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggle(folder.id)}
                  />
                  <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{folder.name}</p>
                    <p className="text-xs text-gray-500">{urlCount} URLs</p>
                  </div>
                </label>
              )
            })}
          </div>

          {selectedFolders.length > 0 && (
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Thứ tự luân phiên ({selectedFolders.length} folders):</div>
              <div className="space-y-2">
                {selectedFolders.map((folder, index) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-2 p-2 bg-sky-50 border border-sky-200 rounded-lg"
                  >
                    <span className="text-xs font-medium text-sky-600 w-6">{index + 1}.</span>
                    <FolderOpen className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="flex-1 text-sm text-gray-900">{folder.name}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMove(folder.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(folder.id, 'down')}
                        disabled={index === selectedFolders.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="primary"
            size="small"
            loading={loading}
            onClick={handleSave}
            disabled={selectedIds.length === 0}
            className="w-full"
          >
            Lưu cấu hình folders
          </Button>
        </>
      )}
    </div>
  )
}
