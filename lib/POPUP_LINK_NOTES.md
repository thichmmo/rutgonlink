# Popup app link selection

Android launch URLs are ephemeral; original popup Android/iOS affiliate fields
remain independent and unchanged. Known HTTPS hosts use `intent:` with the raw
URL suffix and percent-encoded original `browser_fallback_url`. No URLSearchParams
round trip changes signed query bytes. Shopee pins `com.shopee.vn`; TikTok leaves
package selection to Android because vendor associations include regional apps.
Exact vendor host allowlists avoid wrapping unrelated shorteners. Credentials,
nonstandard ports, raw fragments, whitespace and backslashes retain HTTPS rather
than being interpolated into intent syntax. iOS modes are unchanged.

Evidence checked 2026-10-07: `/.well-known/assetlinks.json` on shopee.vn,
www.shopee.vn, s.shopee.vn; tiktok.com, www.tiktok.com, vt.tiktok.com,
vm.tiktok.com, shop.tiktok.com. Do not guess third-party custom schemes.

Primary references:
- https://developer.chrome.com/docs/android/intents
- https://developer.android.com/training/app-links

Verify: `node scripts/test-popup-runtime.cjs --android-check`, full runtime suite,
`node scripts/test-popup-affiliate.cjs`. Intent delivery depends on the installed
apps, Android link preferences and the embedding browser; mocked tests do not
establish native-device success.
