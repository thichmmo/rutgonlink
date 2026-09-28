# Content management helpers

Shared validation normalizes popup settings (including the default Shopee/TikTok creatives), infers TikTok iOS OneLink mode from an `onelink.me` URL, preserves signed iOS OneLinks up to 8192 characters, keeps a separately configured iOS URL when Android/general TikTok URLs are resolved, enforces active-popup ownership for new posts, validates primary/shared/verified custom publication targets, sanitizes rich HTML/video embeds with an allowlist, validates uploaded media URLs, and gates raw HTML/Script to owner/ops actors.

`getPopupStep` is shared by both runtimes. For iPhone/Facebook only, it opens Shopee
through an attached `_blank` link (rather than a script-created blank child) and wraps valid
HTTPS TikTok product URLs in `snssdk1180.onelink.me/BAuo`, preserving the raw signed
URL in `params_url` and its `trackParams`. Existing OneLinks, short links and other
browsers are not rewritten. Navigation is synchronous with the user's click;
Facebook/iOS remains responsible for its native confirmation and app routing.

Verify with `node scripts/test-popup-runtime.cjs`, `pnpm exec eslint lib/content-management.ts lib/popup-settings.ts lib/popup-link.ts` and `pnpm exec tsc --noEmit --pretty false`.
