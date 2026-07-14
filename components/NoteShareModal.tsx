'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Link2, Mail, Copy, Check, Trash2, ChevronDown, Lock, Globe, Eye, PenLine,
} from 'lucide-react'

interface ShareUser {
  id: string
  name: string | null
  email: string
}

interface Share {
  id: string
  permission: string
  user: ShareUser
}

interface PublicInfo {
  isPublic: boolean
  publicToken: string | null
  hasPassword: boolean
}

interface Props {
  noteId: string
  noteTitle: string
  onClose: () => void
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

export default function NoteShareModal({ noteId, noteTitle, onClose }: Props) {
  const [tab, setTab] = useState<'email' | 'link'>('email')

  // Email share state
  const [shares, setShares] = useState<Share[]>([])
  const [loadingShares, setLoadingShares] = useState(true)
  const [emailInput, setEmailInput] = useState('')
  const [permInput, setPermInput] = useState<'viewer' | 'admin'>('viewer')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Public link state
  const [pub, setPub] = useState<PublicInfo>({ isPublic: false, publicToken: null, hasPassword: false })
  const [loadingPub, setLoadingPub] = useState(true)
  const [pwInput, setPwInput] = useState('')
  const [showPwField, setShowPwField] = useState(false)
  const [savingPub, setSavingPub] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchShares = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/share`)
    const data = await res.json()
    setShares(Array.isArray(data) ? data : [])
    setLoadingShares(false)
  }, [noteId])

  const fetchPublic = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}`)
    const data = await res.json()
    setPub({
      isPublic: data.isPublic || false,
      publicToken: data.publicToken || null,
      hasPassword: !!data.publicPassword,
    })
    setLoadingPub(false)
  }, [noteId])

  useEffect(() => { fetchShares() }, [fetchShares])
  useEffect(() => { fetchPublic() }, [fetchPublic])

  const handleAddShare = async () => {
    if (!emailInput.trim()) return
    setAdding(true)
    setAddError('')
    const res = await fetch(`/api/notes/${noteId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.trim(), permission: permInput }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error || 'Đã xảy ra lỗi')
      setAdding(false)
      return
    }
    setShares(prev => {
      const exists = prev.findIndex(s => s.id === data.id)
      if (exists >= 0) {
        const next = [...prev]
        next[exists] = data
        return next
      }
      return [...prev, data]
    })
    setEmailInput('')
    setAdding(false)
  }

  const handlePermChange = async (shareId: string, permission: string) => {
    const res = await fetch(`/api/notes/${noteId}/share/${shareId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission }),
    })
    if (res.ok) {
      const updated = await res.json()
      setShares(prev => prev.map(s => s.id === shareId ? updated : s))
    }
  }

  const handleRemoveShare = async (shareId: string) => {
    await fetch(`/api/notes/${noteId}/share/${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  const handleTogglePublic = async (isPublic: boolean) => {
    setSavingPub(true)
    const res = await fetch(`/api/notes/${noteId}/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPublic,
        password: isPublic && showPwField ? pwInput : '',
      }),
    })
    const data = await res.json()
    if (res.ok) setPub(data)
    setSavingPub(false)
  }

  const handleSavePassword = async () => {
    setSavingPub(true)
    const res = await fetch(`/api/notes/${noteId}/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: true, password: pwInput }),
    })
    const data = await res.json()
    if (res.ok) {
      setPub(data)
      setShowPwField(false)
      setPwInput('')
    }
    setSavingPub(false)
  }

  const publicUrl = pub.publicToken ? `${ORIGIN}/share/${pub.publicToken}` : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const userInitial = (u: ShareUser) =>
    ((u.name?.[0] || u.email[0]) || '?').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Chia sẻ ghi chú</h2>
            <p className="text-xs text-gray-400 truncate mt-0.5">{noteTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer ${
              tab === 'email' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4" />
            Chia sẻ qua email
          </button>
          <button
            onClick={() => setTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer ${
              tab === 'link' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Link công khai
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'email' && (
            <div className="p-6 flex flex-col gap-4">
              {/* Add share input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Nhập email người dùng</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => { setEmailInput(e.target.value); setAddError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleAddShare()}
                    placeholder="email@example.com"
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent min-w-0"
                  />
                  {/* Permission selector */}
                  <div className="relative shrink-0">
                    <select
                      value={permInput}
                      onChange={e => setPermInput(e.target.value as 'viewer' | 'admin')}
                      className="appearance-none pl-3 pr-7 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer bg-white"
                    >
                      <option value="viewer">Xem</option>
                      <option value="admin">Sửa</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {addError && <p className="text-xs text-red-500">{addError}</p>}
                <button
                  onClick={handleAddShare}
                  disabled={!emailInput.trim() || adding}
                  className="self-end px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed font-medium"
                >
                  {adding ? 'Đang thêm...' : 'Chia sẻ'}
                </button>
              </div>

              {/* Shared list */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  {loadingShares ? 'Đang tải...' : shares.length === 0 ? 'Chưa chia sẻ với ai' : `Đã chia sẻ với ${shares.length} người`}
                </p>
                <div className="flex flex-col gap-2">
                  {shares.map(share => (
                    <div key={share.id} className="flex items-center gap-3 py-2">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-sm font-semibold shrink-0">
                        {userInitial(share.user)}
                      </div>
                      {/* Name/email */}
                      <div className="flex-1 min-w-0">
                        {share.user.name && (
                          <p className="text-sm font-medium text-gray-900 truncate">{share.user.name}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate">{share.user.email}</p>
                      </div>
                      {/* Permission */}
                      <div className="relative shrink-0">
                        <select
                          value={share.permission}
                          onChange={e => handlePermChange(share.id, e.target.value)}
                          className="appearance-none pl-2.5 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer bg-white"
                        >
                          <option value="viewer">Xem</option>
                          <option value="admin">Sửa</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      </div>
                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveShare(share.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="border-t border-gray-100 pt-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                  <span><strong>Xem</strong> — chỉ có thể đọc ghi chú</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <PenLine className="w-3.5 h-3.5 text-gray-400" />
                  <span><strong>Sửa</strong> — có thể chỉnh sửa nội dung</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'link' && (
            <div className="p-6 flex flex-col gap-5">
              {loadingPub ? (
                <div className="text-sm text-gray-400">Đang tải...</div>
              ) : (
                <>
                  {/* Toggle public */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pub.isPublic ? 'bg-sky-50' : 'bg-gray-100'}`}>
                        <Globe className={`w-5 h-5 ${pub.isPublic ? 'text-sky-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Link công khai</p>
                        <p className="text-xs text-gray-500">
                          {pub.isPublic ? 'Bất kỳ ai có link đều xem được' : 'Hiện đang tắt'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePublic(!pub.isPublic)}
                      disabled={savingPub}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                        pub.isPublic ? 'bg-sky-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        pub.isPublic ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {pub.isPublic && (
                    <>
                      {/* Copy link */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-600">Link chia sẻ</label>
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={publicUrl}
                            className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 focus:outline-none min-w-0"
                          />
                          <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shrink-0"
                          >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Đã sao chép' : 'Sao chép'}
                          </button>
                        </div>
                      </div>

                      {/* Password protection */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {pub.hasPassword ? 'Đang có mật khẩu' : 'Bảo vệ bằng mật khẩu'}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowPwField(!showPwField)}
                            className="text-xs text-sky-600 hover:underline cursor-pointer"
                          >
                            {pub.hasPassword ? 'Đổi mật khẩu' : (showPwField ? 'Huỷ' : 'Thêm mật khẩu')}
                          </button>
                        </div>

                        {showPwField && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={pwInput}
                              onChange={e => setPwInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSavePassword()}
                              placeholder="Nhập mật khẩu..."
                              autoFocus
                              className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-0"
                            />
                            <button
                              onClick={handleSavePassword}
                              disabled={!pwInput.trim() || savingPub}
                              className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed font-medium shrink-0"
                            >
                              Lưu
                            </button>
                          </div>
                        )}

                        {pub.hasPassword && !showPwField && (
                          <button
                            onClick={async () => {
                              setSavingPub(true)
                              const res = await fetch(`/api/notes/${noteId}/public`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isPublic: true, password: '' }),
                              })
                              const d = await res.json()
                              if (res.ok) setPub(d)
                              setSavingPub(false)
                            }}
                            className="text-xs text-red-500 hover:underline cursor-pointer self-start"
                          >
                            Xoá mật khẩu
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
