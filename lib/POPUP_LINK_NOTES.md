# Popup app link selection

Original popup Android/iOS affiliate fields remain independent and unchanged.
Android Shopee uses the original HTTPS `_blank` anchor. Android TikTok uses the
original Android HTTPS `_self` anchor, with no click-time or request-time Android
resolution. Request preparation strips legacy `androidLaunchUrl` metadata.

Fresh physical tests on 2026-10-07 found the derived `snssdk1180://ec/pdp`
candidate could open TikTok but show a product-load error, despite an earlier
successful user test. The original Android HTTPS link opened the correct shared
product card on Chrome; the native **Xem mặt hàng** button opened the complete
PDP. This is a two-gesture path, not proof of a direct native PDP fix.

When `forceChromeAndroid` is enabled, Android Facebook transfers the actual
article to Chrome before either affiliate step. See
[browser gate notes](POPUP_BROWSER_GATE_NOTES.md) for the consent and state
contract. Ordinary Android launch links are never replaced by an iOS URL.

Native intent builders remain available as compatibility helpers and preserve
the complete signed `params_url` plus the original-source fallback. They are no
longer selected by popup runtime. Their syntax tests do not prove app success.
Existing iOS Facebook short-link preparation, OneLink mode, timeout and cache
behavior remain unchanged; Android no longer shares that resolution path.

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

The original Shopee HTTPS `_blank` link remains unchanged. Four isolated HTTPS
trials on 2026-10-07 passed on a real Android 16 phone: standalone/React through
Facebook→Chrome and both renderers directly in Chrome. The user explicitly chose
to keep the Chrome button and Facebook's native **Tiếp tục** confirmation. Shopee
opened its offers landing; the exact original Android TikTok source opened the
correct T20 shared card, followed by the native **Xem mặt hàng** gesture to the
full PDP. Article return, countdown, cooldown-zero reload and two accepted local
affiliate clicks per original trial passed. Six tested source hashes matched.
iOS is automated-only; production deployment, database counts and commission
attribution are separate checks.

## iOS Universal Link handoff across Safari & in-app webviews (2026-11-18)

- On iOS (`iPhone`/`iPad`/`iPod`, including Mobile Safari and Facebook/Messenger/Zalo webviews), both `SHOPEE` and `TIKTOK` use `'anchor-same-tab'` (`<a data-popup-native-link target="_self">`) instead of `window.open(..., '_blank')` or `_blank` anchors. Spawning a `_blank` tab on iOS breaks `WKNavigationTypeLinkActivated` Universal Link interception and strands visitors on the newly opened `shopee.vn` web tab instead of returning to the TikTok popup.
- `getTikTokIosLaunchUrl` and `preparePopupSettingsForRequest` wrap/resolve TikTok product and `vt.tiktok.com` / `vm.tiktok.com` short links into TikTok's first-party Universal Link (`https://www.tiktokv.com/redirect/?redirect_url=snssdk1180%3A%2F%2Fec%2Fpdp...&dl=<productUrl>&ug_source=Facebook&decode_once=1`) across all iOS user agents (`isIosUserAgent`).
  - Why: `www.tiktokv.com/.well-known/apple-app-site-association` registers `"/redirect*"` directly for `MJ797D8U6F.com.ss.iphone.ugc.Ame` and `MJ797D8U6F.com.zhiliaoapp.musically`, and setting `dl` to the signed `www.tiktok.com` product URL avoids navigating Facebook's iOS `WKWebView` to `snssdk1180.onelink.me` (which triggered Facebook's *"Tiếp tục truy cập trang web này? ... https://snssdk1180.onelink.me/"* warning dialog).
  - `buildTikTokOneLinkUrl` is also fixed to use `/BAuo/` (matching `{"/": "/BAuo/*"}` in `snssdk1180.onelink.me`'s AASA) plus `af_force_deeplink=true` (avoiding a `301` redirect to the regional App Store) as the `<= 8192` length fallback when an oversized signed query cannot fit in `redirect_url` + `dl`.
- Android (`SHOPEE` `_blank`, `TIKTOK` `_self` raw HTTPS) on standard Chrome and desktop remain unchanged.
- Verify: `node scripts/test-popup-runtime.cjs --android-native-check`, `node scripts/test-popup-runtime.cjs`, and `node scripts/test-popup-affiliate.cjs`.

## Multi-OEM Android app-link intent & HarmonyOS compatibility (2026-11-18)

- `isAndroidDeviceUserAgent` (`lib/popup-link.ts` / `isAndroidUserAgent` in `lib/popup-settings.ts`) also matches Huawei HarmonyOS / OpenHarmony mobile browsers (`/(?:harmonyos|openharmony).*(?:mobile|phone|arkweb)/i`).
- Standard Chrome on Android keeps raw HTTPS (`SHOPEE` `_blank`, `TIKTOK` `_self`). Standalone OEM browsers (`SamsungBrowser`, `MiuiBrowser`, `HeyTapBrowser`, `OppoBrowser`, `RealmeLink`, `VivoBrowser`, `HuaweiBrowser`, `ArkWeb`, `UCBrowser`, `Firefox/`) and non-`FB4A` restricted webviews (`FBLite`, `Orca-Android`, `Messenger`, `Instagram`, `Barcelona`, `Zalo`, `BytedanceWebview`, `Telegram-Android`, `Line/`) disable automatic `https://` App Links or drop `_blank` windows; for `assetlinks.json`-verified hosts (`SHOPEE_ANDROID_HOSTS`: `shopee.vn`, `www.shopee.vn`, `s.shopee.vn`, `vn.shp.ee`; `TIKTOK_ANDROID_HOSTS`), `buildAndroidPopupLaunchUrl` wraps the exact unmodified HTTPS URL in a `scheme=https` Android `intent://` (`package=com.shopee.vn` / `package=com.ss.android.ugc.trill`) with `S.browser_fallback_url` set to the original HTTPS URL and `_self` (`anchor-same-tab`), while `step.url` retains raw HTTPS for explicit `Mở liên kết web` fallback. Unverified short domains (`shope.ee`, `shp.ee`) stay raw HTTPS.
