# Popup click tracking

Published mobile posts record one event when a visitor taps the Shopee or TikTok popup action. The dashboard aggregates those events per post and popup for the last hour, today, yesterday, and the day before.

Verification: `pnpm build`, `node scripts/test-popup-clicks.cjs`, and `node scripts/test-popup-runtime.cjs`.
