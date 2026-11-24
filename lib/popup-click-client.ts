export type PopupClickTracking = { postId: string; popupId: string; token: string }

// Keep this function self-contained: the standalone public route embeds the same implementation.
export function sendPopupClick(tracking: PopupClickTracking | undefined, platform: string, providedEventId?: string) {
  if (!tracking) return
  try {
    const eventId = providedEventId && /^[a-zA-Z0-9_-]{16,100}$/.test(providedEventId)
      ? providedEventId
      : (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)
    const body = JSON.stringify({ ...tracking, platform: platform.toUpperCase(), eventId })
    // Queue on confirmed app/page departure without awaiting a network request or mutating page storage.
    try { if (window.navigator.sendBeacon?.('/api/popup-clicks', body)) return } catch { /* Try keepalive if the beacon queue is unavailable. */ }
    void window.fetch('/api/popup-clicks', {
      method: 'POST', body, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch(() => {})
  } catch { /* Analytics must never prevent opening the affiliate link. */ }
}
