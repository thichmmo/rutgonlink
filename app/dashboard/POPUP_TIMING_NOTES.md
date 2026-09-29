# Popup timing display

`popup-timing.ts` normalizes saved Shopee/TikTok delay seconds and cooldown minutes for dashboard-only labels. Popup Manager, article creation, and the article list use the same `S …s · T …s · Cooldown …m` formatter. `PopupTimingPreview` adds a deterministic two-step preview with a wall-clock countdown, disabled action until expiry, progress bar, and reset; it never opens affiliate links or writes click/cooldown state. The public popup runtime continues to own the live countdown.

Verification: run `pnpm exec tsc --noEmit --pretty false` and `node scripts/test-popup-runtime.cjs` from the repository root.
