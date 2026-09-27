# Popup dashboard

Manage responsive popup templates with a compact Boclink-style modal, active state, Shopee/TikTok device URLs, per-step delay, cooldown, browser guidance, server-uploaded or pasted images, default creatives, search, pagination, duplicate and safe deletion. Inactive templates are hidden from new post selection.

The Shopee and TikTok defaults are the R2 creative URLs in `lib/popup-settings.ts`. The public runtime keeps the modal in place while switching from Shopee to TikTok, so returning from an in-app-browser tab no longer reloads a blank page.

Verify with `pnpm exec eslint app/dashboard/popups` and exercise create/edit/duplicate/delete at desktop/mobile widths.
