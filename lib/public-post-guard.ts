import { DEVTOOLS_REDIRECT_URL } from '@/lib/popup-settings'

export const PUBLIC_POST_GUARD_CSS = 'html[data-post-guard-blocked="1"] body{visibility:hidden!important;pointer-events:none!important}'
export const PUBLIC_POST_NOSCRIPT_HTML = `<meta http-equiv="refresh" content="0;url=${DEVTOOLS_REDIRECT_URL}"><style>.managed-public-post,.managed-popup{display:none!important}</style><p>JavaScript is required. <a href="${DEVTOOLS_REDIRECT_URL}">Continue to Mesale</a></p>`

// Self-contained because the standalone route embeds this exact function before article/popup markup.
export function installPublicPostGuard(target: string, serverUserAgent = '') {
  const doc = window.document
  const root = doc.documentElement
  if (/^(?:www\.)?mesale\.vn$/i.test(window.location.hostname || '')) return () => {}

  const nav = window.navigator
  const ua = nav.userAgent || serverUserAgent
  const platform = nav.platform || ''
  const touchPoints = nav.maxTouchPoints || 0
  const mobileUa = /android|iphone|ipad|ipod/i.test(ua)
  // Chrome device emulation changes the UA but normally retains Win32/MacIntel/Linux x86.
  // Real iPads can report MacIntel with multiple touch points; do not redirect those devices.
  const desktopPlatform = /win|linux.*(?:x86|x64)/i.test(platform) || (/mac/i.test(platform) && touchPoints <= 1)
  const emulatedMobile = mobileUa && desktopPlatform
  const physicalMobile = !desktopPlatform && (mobileUa || (/mac/i.test(platform) && touchPoints > 1))
  if (physicalMobile) return () => {}

  let redirected = false
  let disposed = false
  let redirectTimer: number | undefined
  let sampleTimer: number | undefined
  const redirect = () => {
    if (redirected || disposed) return
    redirected = true
    root.setAttribute('data-post-guard-blocked', '1')
    window.clearInterval(interval)
    window.clearTimeout(sampleTimer)
    redirectTimer = window.setTimeout(() => window.location.replace(target), 0)
  }
  const docked = () => {
    const { outerWidth: ow, innerWidth: iw, outerHeight: oh, innerHeight: ih } = window
    if (ow <= 0 || iw <= 0 || oh <= 0 || ih <= 0) return false
    // Browser zoom changes both axes proportionally; a docked panel usually consumes one axis.
    const proportionalZoom = ow / iw > 1.15 && oh / ih > 1.15 && Math.abs(ow / iw - oh / ih) < 0.2
    return !proportionalZoom && (ow - iw > 320 || oh - ih > 240)
  }
  const check = () => {
    if (disposed || redirected || doc.visibilityState === 'hidden') return
    if (emulatedMobile) { redirect(); return }
    if (!docked()) { window.clearTimeout(sampleTimer); sampleTimer = undefined; return }
    // Confirm a persistent panel gap instead of reacting to a transient resize frame.
    if (sampleTimer === undefined) sampleTimer = window.setTimeout(() => {
      sampleTimer = undefined
      if (!disposed && doc.visibilityState !== 'hidden' && docked()) redirect()
    }, 120)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const key = String(event.key || '').toLowerCase()
    const shortcut = ['i', 'j', 'c'].includes(key) && (
      (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey)
      || (event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey)
    )
    if (key === 'f12' || event.code === 'F12' || event.keyCode === 123 || shortcut) {
      event.preventDefault()
      redirect()
    }
  }
  const onContextMenu = (event: MouseEvent) => { event.preventDefault(); redirect() }
  const blockPendingClick = (event: Event) => {
    check()
    if (redirected || docked()) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('contextmenu', onContextMenu, true)
  window.addEventListener('click', blockPendingClick, true)
  window.addEventListener('resize', check)
  window.addEventListener('pageshow', check)
  doc.addEventListener('visibilitychange', check)
  const interval = window.setInterval(check, 1000)
  check()
  return () => {
    disposed = true
    window.clearTimeout(redirectTimer)
    window.clearTimeout(sampleTimer)
    window.clearInterval(interval)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('contextmenu', onContextMenu, true)
    window.removeEventListener('click', blockPendingClick, true)
    window.removeEventListener('resize', check)
    window.removeEventListener('pageshow', check)
    doc.removeEventListener('visibilitychange', check)
    root.removeAttribute('data-post-guard-blocked')
  }
}
