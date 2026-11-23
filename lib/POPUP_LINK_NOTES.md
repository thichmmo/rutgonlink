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

## iOS & Android `"Others"` Attribution Parity + Universal Link Handoff (2026-11-23)

- Across **both iOS (`iPhone`/`iPad`/`iPod` — Mobile Safari, Facebook `FBIOS`, Messenger, Zalo) and Android**, `SHOPEE` uses `'anchor-new-tab'` (`<a data-popup-native-link target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">`), whereas `TIKTOK` keeps `'anchor-same-tab'` (`target="_self"`).
  - Why: In WebKit (`WebPageProxy.cpp` & `NavigationState.mm`) and Facebook's iOS `WKWebView`, `target="_self"` navigates the main frame (`targetFrame != nil`, `sourceFrame = wrapper domain`), leaking the satellite website context on Universal Link handoff so Shopee Affiliate classified clicks as `"Website"`. Opening Shopee in `_blank` with `noopener noreferrer` + `no-referrer` routes through `decidePolicyForNewWindowAction` (`targetFrame = nil`, `opener = null`, `shouldOpenAppLinks = true`, `LSAppLink` `configuration.referrerURL = nil`) so Shopee App opens natively with zero referrer and Shopee Affiliate records `"Others"` (matching `boclinkaff`).
- `lib/shopee-link.ts` (`isShopeeShortUrl`, `expandShopeeShortUrl`) expands `s.shopee.*`, `shope.ee`, and `shp.ee` short links via `DESKTOP_SHORTENER_REDIRECT_UA` `301` redirect to `https://shopee.vn/opaanlp/...` on both paste (`/api/content/resolve-affiliate`) and popup create/update (`POST /api/popups`, `PUT /api/popups/[id]`), preventing `s.shopee.vn`'s mobile JS shim from redirecting with `Referer: https://s.shopee.vn/` (`stm_medium: "referral"` in `@shopee/tracking-ubt`).
- `getTikTokIosLaunchUrl` and `preparePopupSettingsForRequest` wrap/resolve TikTok product and `vt.tiktok.com` / `vm.tiktok.com` short links into TikTok's first-party Universal Link (`https://www.tiktokv.com/redirect/?redirect_url=snssdk1180%3A%2F%2Fec%2Fpdp...&dl=<productUrl>&ug_source=Facebook&decode_once=1`) across all iOS user agents (`isIosUserAgent`).
  - Why: `www.tiktokv.com/.well-known/apple-app-site-association` registers `"/redirect*"` directly for `MJ797D8U6F.com.ss.iphone.ugc.Ame` and `MJ797D8U6F.com.zhiliaoapp.musically`, and setting `dl` to the signed `www.tiktok.com` product URL avoids navigating Facebook's iOS `WKWebView` to `snssdk1180.onelink.me` (which triggered Facebook's *"Tiếp tục truy cập trang web này? ... https://snssdk1180.onelink.me/"* warning dialog).
  - `buildTikTokOneLinkUrl` is also fixed to use `/BAuo/` (matching `{"/": "/BAuo/*"}` in `snssdk1180.onelink.me`'s AASA) plus `af_force_deeplink=true` (avoiding a `301` redirect to the regional App Store) as the `<= 8192` length fallback when an oversized signed query cannot fit in `redirect_url` + `dl`.
- Verify: `node scripts/test-popup-runtime.cjs --android-native-check`, `node scripts/test-popup-runtime.cjs`, and `node scripts/test-popup-affiliate.cjs`.

## Multi-OEM + Standard Chrome Android app-link intent & HarmonyOS compatibility (2026-11-18)

- `isAndroidDeviceUserAgent` (`lib/popup-link.ts` / `isAndroidUserAgent` in `lib/popup-settings.ts`) also matches Huawei HarmonyOS / OpenHarmony mobile browsers (`/(?:harmonyos|openharmony).*(?:mobile|phone|arkweb)/i`).
- On Android (`isAndroidDeviceUserAgent`), `SHOPEE` keeps its unmodified raw HTTPS URL (`buildAndroidPopupLaunchUrl` returns `value`) and opens via `'anchor-new-tab'` (`<a target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">`), matching Boclink so Android/OEM browsers never pass `intent://` `EXTRA_REFERRER` or `android-app://com.android.chrome` as `"Website"` to Shopee Affiliate (recording `"Others"` instead).
- For `TIKTOK` on standalone Android browsers (`isAndroidIntentBrowserUserAgent` — including standard Google Chrome, Cốc Cốc, Edge, Brave, Opera, Vivaldi, `SamsungBrowser`, `MiuiBrowser`, `HeyTapBrowser`, `OppoBrowser`, `RealmeLink`, `VivoBrowser`, `HuaweiBrowser`, `ArkWeb`, `UCBrowser`, `Firefox/`) and non-`FB4A` webviews, `TIKTOK_ANDROID_HOSTS` (`tiktok.com`, `www.tiktok.com`, `vt.tiktok.com`, `vm.tiktok.com`, `shop.tiktok.com`) wrap into a `scheme=https` Android `intent://` (`package=com.ss.android.ugc.trill`) with `S.browser_fallback_url` set to the exact unmodified HTTPS URL and `_self` (`anchor-same-tab`) so TikTok Shop jumps natively on one tap without stopping on web shared cards.
  - Legacy `FB4A` WebView (when `forceChromeAndroid` is off) and Presto `Opera Mini/` stay raw HTTPS, and `step.url` always retains raw HTTPS for explicit `Mở liên kết web` fallback.
