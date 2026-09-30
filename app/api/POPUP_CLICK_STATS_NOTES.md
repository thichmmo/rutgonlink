# Popup click tracking

`POST /api/popup-clicks` accepts a signed, same-host event from a published mobile post. Events are idempotent by `eventId`, ignore bots, and are stored per user, post, popup, and platform. `GET /api/popup-stats` returns UTC+7 windows for the dashboard.

Verification: `node scripts/test-popup-clicks.cjs`.
