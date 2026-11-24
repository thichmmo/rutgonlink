# Popup click data

Signed tokens bind click events to the rendered post, popup, and host. Aggregation uses Asia/Ho_Chi_Minh day boundaries while storage remains UTC timestamps.


- Updated (2026-11-21): `getPopupClickList` searches `(m.title LIKE %q% OR m.slug LIKE %q%)` for `group === 'post'` so searching by 5-digit code (`37325`) matches both code-titled and legacy `p7-37325` posts.
- Updated (2026-11-24): [popup-click-client.ts](popup-click-client.ts) `sendPopupClick(tracking, platform, providedEventId?)` accepts a step-scoped `eventId` so retries/fallbacks stay idempotent and uses `credentials: 'same-origin'` on its `keepalive` fetch fallback so browsers carry the `HttpOnly` `rgl_vid` deduplication cookie without mutating `localStorage` or `document.cookie`.
