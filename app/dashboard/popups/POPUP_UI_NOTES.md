# Popup dashboard

Manage responsive popup templates with a compact Boclink-style modal, active state, Shopee/TikTok device URLs, per-step delay, cooldown, browser guidance, server-uploaded or pasted images, default creatives, search, pagination, duplicate and safe deletion. The list exposes the saved timer summary (`S …s · T …s · Cooldown …m`) so an operator can verify the values without reopening the form. The iOS TikTok field accepts long OneLinks (up to 8192 characters); Facebook iPhone automatically wraps a TikTok product URL into a Boclink-compatible OneLink while preserving its signed query, and sends it through the current tab for universal-link handoff. Inactive templates are hidden from new post selection.

The Shopee and TikTok defaults are the R2 creative URLs in `lib/popup-settings.ts`. The public runtime keeps the modal in place while switching from Shopee to TikTok, so returning from an in-app-browser tab no longer reloads a blank page.

Editing Android now updates the required general URL as well. Manual Android edits preserve a distinct iOS URL. Explicit TikTok affiliate processing instead replaces only the iOS destination and mode, never the Android/general source.

Verify with `node scripts/test-popup-runtime.cjs`, `pnpm exec eslint app/dashboard/popups` and exercise create/edit/duplicate/delete at desktop/mobile widths.

Delay inputs are labeled "Chờ mở link" (not initial display delay). The preview is isolated from live navigation and cooldown state; zero remains a deliberate saved value. Verify preview countdown/cleanup with `node scripts/test-popup-timing.cjs`.

## TikTok affiliate conversion isolation (2026-10-07)

The TikTok affiliate action reads the Android source and writes only `tiktok.iosUrl`/`iosMode` (plus returned image). `secondUrl`, `tiktok.url` and `androidUrl` remain unchanged, including repeated processing and save/edit. Manual source typing still follows the existing iOS fallback rules. Shopee keeps its own resolution behavior.

Resolver warnings/errors leave the previous destination intact. Pending requests are invalidated/aborted on source, iOS or mode edits and dialog lifecycle changes; a stale response cannot overwrite a newer draft or unlock a newer request. Saving is disabled while resolving. Errors appear inside the dialog. URL inputs do not truncate pasted signed links: the shared 8192-character validation returns an explicit message rather than cutting tracking parameters.

Verification: `node scripts/test-popup-affiliate.cjs`, existing popup runtime/timing/API suites, scoped ESLint and TypeScript. Regression fixtures cover Android preservation, long signed URLs, repeated conversion, failures and stale responses.
