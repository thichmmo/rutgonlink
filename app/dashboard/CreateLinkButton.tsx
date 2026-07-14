'use client'

import { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/fetch'
import { Link2 } from 'lucide-react'
import CreateLinkModal from '@/components/CreateLinkModal'

interface Domain {
  id: string
  domain: string
  verified: boolean
}

interface Category {
  id: string
  name: string
  color: string
}

interface Workspace {
  id: string
  name: string
}

export default function CreateLinkButton() {
  const [showModal, setShowModal] = useState(false)
  const [domains, setDomains] = useState<Domain[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [canDeviceRedirect, setCanDeviceRedirect] = useState(true)
  const [canGeoRedirect, setCanGeoRedirect] = useState(true)

  const openModal = useCallback(async () => {
    const [domainsRes, categoriesRes, workspacesRes, usageRes] = await Promise.all([
      apiFetch('/api/domains'),
      fetch('/api/categories'),
      fetch('/api/workspace'),
      fetch('/api/user/usage'),
    ])
    const domainsData = await domainsRes.json()
    const categoriesData = await categoriesRes.json()
    const workspacesData = await workspacesRes.json()
    const usageData = await usageRes.json()
    setDomains(Array.isArray(domainsData) ? domainsData : [])
    setCategories(Array.isArray(categoriesData) ? categoriesData : [])
    const all: Workspace[] = [
      ...(workspacesData.owned || []),
      ...(workspacesData.memberOf || []),
    ]
    setWorkspaces(all)
    setCanDeviceRedirect(usageData?.limits?.canDeviceRedirect ?? true)
    setCanGeoRedirect(usageData?.limits?.canGeoRedirect ?? true)
    setShowModal(true)
  }, [])

  return (
    <>
      <button
        onClick={openModal}
        className="px-3 lg:px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <Link2 className="w-4 h-4" />
        <span className="hidden sm:inline">Tạo link mới</span>
        <span className="sm:hidden">Tạo</span>
      </button>

      {showModal && (
        <CreateLinkModal
          domains={domains}
          categories={categories}
          workspaces={workspaces}
          canDeviceRedirect={canDeviceRedirect}
          canGeoRedirect={canGeoRedirect}
          onClose={() => setShowModal(false)}
          onSuccess={(shortUrl) => {
            setShowModal(false)
            window.dispatchEvent(new CustomEvent('link-created'))
            if (shortUrl) navigator.clipboard.writeText(shortUrl).catch(() => {})
          }}
        />
      )}
    </>
  )
}
