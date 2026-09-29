# Popup dashboard

Manage responsive popup templates with a compact Boclink-style modal, active state, Shopee/TikTok device URLs, per-step delay, cooldown, browser guidance, server-uploaded or pasted images, default creatives, search, pagination, duplicate and safe deletion. The list exposes the saved timer summary (`S …s · T …s · Cooldown …m`) so an operator can verify the values without reopening the form. The iOS TikTok field accepts long OneLinks (up to 8192 characters); Facebook iPhone automatically wraps a TikTok product URL into a Boclink-compatible OneLink while preserving its signed query, and sends it through the current tab for universal-link handoff. Inactive templates are hidden from new post selection.

The Shopee and TikTok defaults are the R2 creative URLs in `lib/popup-settings.ts`. The public runtime keeps the modal in place while switching from Shopee to TikTok, so returning from an in-app-browser tab no longer reloads a blank page.

Editing Android now updates the required general URL as well. Affiliate resolution
preserves a distinct iOS URL instead of replacing a supplied OneLink with a web URL.

Verify with `node scripts/test-popup-runtime.cjs`, `pnpm exec eslint app/dashboard/popups` and exercise create/edit/duplicate/delete at desktop/mobile widths.
