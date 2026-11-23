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

## iOS & Android `/opaanlp/` Native App Launch + `"Others"` Attribution (2026-11-23)

- Shopee affiliate links strictly preserve `/opaanlp/` (`https://shopee.vn/opaanlp/<shopId>/<itemId>?__mobile__=1&gads_t_sig=...` — never rewritten to `/universal-link/` or `/product/`).
- On **iOS (`iPhone`/`iPad`/`iPod` — Facebook `FBIOS`, Messenger, Zalo, and Mobile Safari)**, both `SHOPEE` and `TIKTOK` use `'anchor-same-tab'` (`<a data-popup-native-link target="_self" rel="noopener noreferrer" referrerpolicy="no-referrer">`).
  - Why: In Facebook iOS `WKWebView` (verified on iPhone 15), `target="_blank"` invokes `WKUIDelegate.createWebViewWithConfiguration` -> `webView.load(request)` (`WKNavigationTypeOther`), suppressing iOS Universal Links and stranding visitors on the `shopee.vn/opaanlp` web page. A visible `_self` `<a>` tap preserves `WKNavigationTypeLinkActivated` so `LSAppLink` launches the native Shopee App (`DGTZ9CPSVT.com.beeasy.shopee.vn`) directly to `/opaanlp/`, while `Referrer-Policy: no-referrer` + `rel="noopener noreferrer" referrerpolicy="no-referrer"` keeps `request.httpReferrer()` empty (`configuration.referrerURL = nil` in WebKit `NavigationState.mm`) so Shopee Affiliate records `"Others"`.
- `lib/shopee-link.ts` (`isShopeeShortUrl`, `expandShopeeShortUrl`) expands `s.shopee.*`, `shope.ee`, and `shp.ee` short links via `DESKTOP_SHORTENER_REDIRECT_UA` `301` redirect to `https://shopee.vn/opaanlp/...` on paste (`/api/content/resolve-affiliate`), on popup create/update (`POST /api/popups`, `PUT /api/popups/[id]`), and via a 5-minute server cache in `preparePopupSettingsForRequest` (`lib/popup-settings-server.ts`) for any legacy unexpanded popup on iOS, preventing `s.shopee.vn`'s mobile JS shim from redirecting with `Referer: https://s.shopee.vn/` (`stm_medium: "referral"` in `@shopee/tracking-ubt`).
- `getTikTokIosLaunchUrl` and `preparePopupSettingsForRequest` wrap/resolve TikTok product and `vt.tiktok.com` / `vm.tiktok.com` short links into TikTok's first-party Universal Link (`https://www.tiktokv.com/redirect/?redirect_url=snssdk1180%3A%2F%2Fec%2Fpdp...&dl=<productUrl>&ug_source=Facebook&decode_once=1`) across all iOS user agents (`isIosUserAgent`).
  - Why: `www.tiktokv.com/.well-known/apple-app-site-association` registers `"/redirect*"` directly for `MJ797D8U6F.com.ss.iphone.ugc.Ame` and `MJ797D8U6F.com.zhiliaoapp.musically`, and setting `dl` to the signed `www.tiktok.com` product URL avoids navigating Facebook's iOS `WKWebView` to `snssdk1180.onelink.me` (which triggered Facebook's *"Tiếp tục truy cập trang web này? ... https://snssdk1180.onelink.me/"* warning dialog).
  - `buildTikTokOneLinkUrl` is also fixed to use `/BAuo/` (matching `{"/": "/BAuo/*"}` in `snssdk1180.onelink.me`'s AASA) plus `af_force_deeplink=true` (avoiding a `301` redirect to the regional App Store) as the `<= 8192` length fallback when an oversized signed query cannot fit in `redirect_url` + `dl`.
- Verify: `node scripts/test-popup-runtime.cjs --android-native-check`, `node scripts/test-popup-runtime.cjs`, and `node scripts/test-popup-affiliate.cjs`.

## Multi-OEM + Standard Chrome Android app-link intent & HarmonyOS compatibility (2026-11-23)

- `isAndroidDeviceUserAgent` (`lib/popup-link.ts` / `isAndroidUserAgent` in `lib/popup-settings.ts`) also matches Huawei HarmonyOS / OpenHarmony mobile browsers (`/(?:harmonyos|openharmony).*(?:mobile|phone|arkweb)/i`).
- On standalone & OEM Android browsers (`isAndroidIntentBrowserUserAgent` — standard Google Chrome, Cốc Cốc, Edge, Brave, Opera, Vivaldi, `SamsungBrowser`, `MiuiBrowser`, `HeyTapBrowser`, `OppoBrowser`, `RealmeLink`, `VivoBrowser`, `HuaweiBrowser`, `ArkWeb`, `UCBrowser`, `Firefox/`) and non-`FB4A` webviews (`FBLite`, `Messenger`, `Instagram`, `Threads`, `Zalo`, `BytedanceWebview`, `Telegram`, `LINE`), both `SHOPEE_ANDROID_HOSTS` (`shopee.vn`, `www.shopee.vn`, `mall.shopee.vn`, `s.shopee.vn`, `vn.shp.ee` -> `package=com.shopee.vn`) and `TIKTOK_ANDROID_HOSTS` (`package=com.ss.android.ugc.trill`) wrap the exact unmodified HTTPS `/opaanlp/` / TikTok URL into a `scheme=https` Android `intent://` with `S.browser_fallback_url` set to the exact HTTPS URL and `_self` (`anchor-same-tab`), while `Referrer-Policy: no-referrer` + `rel="noopener noreferrer" referrerpolicy="no-referrer"` keeps `params.getReferrerUrl().isEmpty() == true` in Chromium `ExternalNavigationHandler.java` (`Intent.EXTRA_REFERRER` unset -> `"Others"`).
  - Legacy `FB4A` WebView (when `forceChromeAndroid` is off) opens raw HTTPS in `_blank` (`anchor-new-tab`), Presto `Opera Mini/` stays raw HTTPS, and `step.url` always retains raw HTTPS for explicit `Mở liên kết web` fallback and unverified short domains (`shope.ee`, `shp.ee`).
