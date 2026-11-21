# Popup click statistics

The dashboard shows Shopee/TikTok click counts per post and popup for the last hour, today, yesterday, and the day before. Polling refreshes every five seconds without overlapping requests; filters and pagination are scoped independently.

The compact summary link targets the overview page where the live analytics section is rendered (`/dashboard#popup-click-analytics`).

Verification: `node scripts/test-popup-clicks.cjs` and the dashboard typecheck.
# Numeric post path display (2026-10-07)

The statistics table uses the shared public path helper, so a numeric Telegram
post displays `/p7/<code>` and its open action matches the API public URL.
Legacy slugs retain their existing path. Verification: popup click regressions
and scoped dashboard lint.


## Post Creation Timestamp, 5-Digit Code Title, & Protocol-Free Copy (2026-11-21)

- `PopupAnalytics.tsx` resolves auto-generated numeric post titles (`Video Telegram`, `Video Telegram - bản sao`) to their 5-digit code (`37325`), shows Vietnam creation time (`Tạo lúc: HH:mm dd/MM/yyyy`), and adds a `Copy link` button beside `Mở bài viết` that copies `publicUrl` without `https://` (`ca33newss.xyz/p7/37325`).
- `PopupClickStats.tsx` listens for `window` `'popup-stats-refresh'` events so quick-created Telegram posts appear in the analytics table immediately.
- Verify: `node scripts/test-quick-telegram-and-post-ui.cjs` and `node scripts/test-popup-clicks.cjs`.
