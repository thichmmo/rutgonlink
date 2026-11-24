# Popup affiliate regressions

Run `node scripts/test-popup-affiliate.cjs` (35 scenarios). The harness loads the real React popup
editor, resolver/TikTok converter, popup create/update routes (`lib/shopee-link.ts` save-time `s.shopee.*` / `shope.ee` auto-expansion + offline fallback), URL schema and
normalizer. Only authentication, Prisma storage, browser timers and network are
fixtures; no production record or affiliate request is created.

Covers byte-for-byte signed query preservation, 2048/2049/4096/8192 boundaries,
explicit oversized rejection, unsafe inputs and redirect/output bounds, Android
source preservation with iOS-only conversion, repeated processing, edit/save,
warning/error preservation, stale responses after edits/close/reopen and Shopee
(verifying `/api/content/resolve-affiliate` never fetches signed `/opaanlp/` on the server and queries unsigned `/product/<shopId>/<itemId>` with `no-referrer`).
Native form validity is checked before simulated submission.

`AFFILIATE_TEST_ROOT=<snapshot> node scripts/test-popup-affiliate.cjs --baseline`
reproduces the old Android overwrite and 2048-character failures. Run the same
command on a restored isolated copy to verify rollback; normal execution against
the modified copy must pass the corrected assertions.

The existing popup runtime and Telegram API harness loaders include the real
shared `popup-affiliate-url` helper so their previous assertions remain active.
