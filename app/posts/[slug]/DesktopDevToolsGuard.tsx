'use client'

import { useEffect } from 'react'
import { DEVTOOLS_REDIRECT_URL, isMobileUserAgent } from '@/lib/popup-settings'

export default function DesktopDevToolsGuard({ userAgent }: { userAgent: string }) {
  useEffect(() => {
    const ua = userAgent || navigator.userAgent || ''
    if (isMobileUserAgent(ua)) return

    const host = window.location.hostname || ''
    if (/^(?:www\.)?mesale\.vn$/i.test(host)) return

    let redirected = false
    const redirect = () => {
      if (redirected) return
      redirected = true
      // Defer navigation until the keyboard event finishes so F12 is not swallowed by the browser.
      window.setTimeout(() => window.location.replace(DEVTOOLS_REDIRECT_URL), 0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const devToolsShortcut = ['i', 'j', 'c'].includes(key) && (
        (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey)
        || (event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey)
      )
      if (key === 'f12' || event.code === 'F12' || event.keyCode === 123 || devToolsShortcut) {
        event.preventDefault()
        redirect()
      }
    }

    // Window dimensions also change with zoom/sidebars; only explicit shortcuts redirect.
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [userAgent])

  return null
}
