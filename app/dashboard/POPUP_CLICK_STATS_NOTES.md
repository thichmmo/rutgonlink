# Popup click statistics

The dashboard shows Shopee/TikTok click counts per post and popup for the last hour, today, yesterday, and the day before. Polling refreshes every five seconds without overlapping requests; filters and pagination are scoped independently.

The compact summary link targets the overview page where the live analytics section is rendered (`/dashboard#popup-click-analytics`).

Verification: `node scripts/test-popup-clicks.cjs` and the dashboard typecheck.
