export type PopupClickTracking = { postId: string; popupId: string; token: string }

// Keep this function self-contained: the standalone public route embeds the same implementation.
export function sendPopupClick(tracking: PopupClickTracking | undefined, platform: string) {
  if (!tracking) return
  try {
    const eventId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    const body = JSON.stringify({ ...tracking, platform: platform.toUpperCase(), eventId })
    // Queue before app handoff without awaiting a network request or consuming the click gesture.
    try { if (window.navigator.sendBeacon?.('/api/popup-clicks', body)) return } catch { /* Try keepalive if the beacon queue is unavailable. */ }
    void window.fetch('/api/popup-clicks', {
      method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch(() => {})
  } catch { /* Analytics must never prevent opening the affiliate link. */ }
}
