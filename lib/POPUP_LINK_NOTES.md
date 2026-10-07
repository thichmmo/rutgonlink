# Popup app link selection

Android launch URLs are ephemeral; original popup Android/iOS affiliate fields
remain independent and unchanged. TikTok uses the native `snssdk1180://ec/pdp`
intent, pinned to `com.ss.android.ugc.trill`, with exactly seven documented fields:
`biz_type`, `enter_method`, `is_commerce`, `need_mall`, `needlaunchlog`, `page_name`,
and `params_url`. Decoding `params_url` returns the complete signed product URL
byte-for-byte; the browser fallback is the original saved Android source.

The user confirmed this native candidate opens the correct product on Chrome
Android (2026-10-07). The prior `scheme=https` TikTok intent failed on the same
device, despite the correct package. Shopee now uses the original HTTPS anchor
with `_blank`, matching the separately confirmed Facebook test without its
previous intent confirmation. Embedding browsers can still ask for consent.

`preparePopupSettingsForRequest` resolves Android short URLs before rendering,
never inside the click handler. Its request-only `androidLaunchUrl` does not
replace saved `androidUrl`, `url`, or `iosUrl`. Normalization strips supplied
metadata, preparation discards old metadata, and the consumer checks the exact
canonical intent and matching original-source fallback. Direct product URLs need
no fetch. Failed, nonproduct or unsupported results keep the original HTTPS URL.
Short-link resolution has one 4-second deadline, 8192-character input/redirect
and final intent limits, a 200-entry coalescing cache, 5-minute success and
15-second failure lifetimes. Android and iOS cache keys are independent.

Exact vendor host allowlists and per-redirect validation reject unrelated hosts,
credentials, nonstandard ports, raw fragments, whitespace, backslashes and malformed
UTF-16. Only Android requests opt into raw signed-URL preservation; iOS modes and
the existing resolver's iOS user agent remain unchanged.

Evidence checked 2026-10-07: `/.well-known/assetlinks.json` on shopee.vn,
www.shopee.vn, s.shopee.vn; tiktok.com, www.tiktok.com, vt.tiktok.com,
vm.tiktok.com, shop.tiktok.com. Do not guess third-party custom schemes.

Primary references:
- https://developer.chrome.com/docs/android/intents
- https://developer.android.com/training/app-links
- https://partner.tiktokshop.com/docv2/page/creator-generate-general-link-202505

Verify: `node scripts/test-popup-runtime.cjs --android-check`, full runtime suite,
`node scripts/test-popup-affiliate.cjs`. Intent delivery depends on the installed
apps, Android link preferences and the embedding browser; mocked tests do not
establish native-device success.

## Facebook confirmation follow-up

The user first confirmed Shopee opens after Facebook's native “Tiếp tục” prompt,
then confirmed the original HTTPS `_blank` link opens it directly. The latter
is now the launch mode; no browser consent mechanism is suppressed.
Verify `node scripts/test-popup-runtime.cjs --android-check` plus physical regular
TikTok on Android. Tests prove target selection, not OS/app behavior.
