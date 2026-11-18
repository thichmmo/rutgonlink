'use client'

import { useEffect } from 'react'
import type { TrancoPingTarget } from '@/lib/tranco-boost-config'

export default function TrancoDomainBooster({ targets }: { targets: TrancoPingTarget[] }) {
  useEffect(() => {
    if (!targets.length || document.documentElement.hasAttribute('data-post-guard-blocked')) return

    let cancelled = false
    const fire = () => {
      if (
        cancelled ||
        document.documentElement.hasAttribute('data-post-guard-blocked') ||
        document.querySelector('[data-popup-browser-gate]')
      ) {
        return
      }
      if (typeof window.Image !== 'function') return
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      for (const target of targets) {
        try {
          const img = new window.Image(1, 1)
          img.referrerPolicy = 'no-referrer'
          img.decoding = 'async'
          if ('fetchPriority' in img) {
            ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
          }
          img.src = `${target.beaconBaseUrl}?d=${day}`
        } catch {
          // Ignore network/CSP failures silently.
        }
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(fire, { timeout: 600 })
      return () => {
        cancelled = true
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
      }
    }

    queueMicrotask(fire)
    return () => {
      cancelled = true
    }
  }, [targets])

  if (!targets.length) return null

  return (
    <>
      {targets.map((target) => (
        <span key={target.domain} hidden>
          <link rel="dns-prefetch" href={`//${target.domain}`} />
          <link rel="preconnect" href={`https://${target.domain}`} crossOrigin="anonymous" />
        </span>
      ))}
    </>
  )
}
