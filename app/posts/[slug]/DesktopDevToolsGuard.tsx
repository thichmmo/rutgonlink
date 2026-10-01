'use client'

import { useEffect } from 'react'
import { DEVTOOLS_REDIRECT_URL } from '@/lib/popup-settings'
import { installPublicPostGuard } from '@/lib/public-post-guard'

export default function DesktopDevToolsGuard({ userAgent }: { userAgent: string }) {
  useEffect(() => installPublicPostGuard(DEVTOOLS_REDIRECT_URL, userAgent), [userAgent])

  return null
}
