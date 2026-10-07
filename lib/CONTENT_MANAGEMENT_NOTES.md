# Content management helpers

Shared validation normalizes popup settings (including the default Shopee/TikTok creatives), infers TikTok iOS OneLink mode from an `onelink.me` URL, preserves signed popup/affiliate URLs up to 8192 characters on every platform, retains separate Android/iOS destinations, enforces active-popup ownership for new posts, validates primary/shared/verified custom publication targets, sanitizes rich HTML/video embeds with an allowlist, validates uploaded media URLs, and gates raw HTML/Script to owner/ops actors.

`popup-affiliate-url.ts` owns the shared 8192-character limit and Vietnamese URL
validation messages used by popup persistence, affiliate resolution and the editor.
Validation accepts only credential-free HTTP(S) URLs, without reserializing their
query strings. General/Android fields no longer fall back at 2048 characters while
iOS accepts the same signed link. New writes reject overlong nested platform links
with field-specific messages before normalization; other invalid legacy settings
retain the existing fallback behavior. No stored links or runtime OneLink rules
are migrated.

`sanitizeRichHtml` now shares the provider iframe allowlist with `lib/video-embed.ts`; supported YouTube, TikTok player, Vimeo, Facebook and Instagram embeds survive server sanitization while arbitrary iframe hosts are removed. `normalizeVideoEmbedUrl` converts share links into provider embed URLs before the editor inserts them, and rejects TikTok product pages that cannot render as video embeds. Clipboard image paste accepts both `DataTransfer.files` and Safari's `DataTransfer.items`, so screenshots copied from iPhone and desktop apps work in the Facebook preview card.

`getPopupStep` is shared by both runtimes. For iPhone/Facebook only, it opens Shopee
through an attached `_blank` link (rather than a script-created blank child) and wraps valid
HTTPS TikTok product URLs in `snssdk1180.onelink.me/BAuo`, preserving the raw signed
URL in `params_url` and its `trackParams`. `popup-settings-server.ts` expands iOS
Facebook `vt.tiktok.com`/`vm.tiktok.com` URLs before rendering, stopping at the signed
product redirect (before any login redirect) and building the same OneLink. A
4-second chain deadline, bounded 200-entry cache, 5-minute success TTL and 15-second
failure TTL bound latency and upstream load. Saved fields, custom iOS OneLinks and
other devices stay unchanged. A failed lookup keeps the original short URL in the
current tab. Navigation is synchronous with the user's click;
Facebook/iOS remains responsible for its native confirmation and app routing.

`popupAppliesToDevice` requires an iPhone/iPad/iPod/Android user agent before
checking the saved platform toggles. Desktop and unknown UAs read the article
without popups. Both post renderers share this rule and the fixed desktop
keyboard redirect destination, `https://mesale.vn`. This does not change popup
delays, cooldowns, app-launch URLs or signed tracking parameters.

Uploaded content resolves from `CONTENT_UPLOAD_DIR` when configured. Without it,
standalone cPanel releases detect both the live `.next/standalone` tree and the
`.deploy/<id>/unpacked/.next/standalone` preflight tree, while local development
continues to use `uploads/content` below the current working directory.

Verify with `node scripts/test-popup-affiliate.cjs`, `node scripts/test-popup-runtime.cjs`, `node scripts/test-content-media.cjs`, `pnpm exec eslint lib/content-management.ts lib/popup-affiliate-url.ts lib/popup-settings.ts lib/popup-link.ts lib/video-embed.ts` and `pnpm exec tsc --noEmit --pretty false`.
