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

## iOS & Android `/opaanlp/` Native App Launch + `"Others"` Attribution (2026-11-24)

- Shopee affiliate links strictly preserve `/opaanlp/` (`https://shopee.vn/opaanlp/<shopId>/<itemId>?__mobile__=1&gads_t_sig=...` — never rewritten to `/universal-link/` or `/product/`).
- On **iOS (`iPhone`/`iPad`/`iPod`)**, both `SHOPEE` and `TIKTOK` use `'anchor-same-tab'` (`<a data-popup-native-link target="_self" rel="noopener noreferrer" referrerpolicy="no-referrer">`):
  - **Captive iOS In-App WebViews** (`isIosInAppWebViewUserAgent` — Facebook `FBIOS` on iPhone 15 iOS 18.5+, Messenger, Instagram, Threads, Zalo, TikTok, Telegram, LINE) wrap the unmodified `https://shopee.vn/opaanlp/...` URL via `buildShopeeIosLaunchUrl` into `shopeevn://reactPath?navigate_url=<encodeURIComponent(exact_opaanlp_url)>&path=shopee%2FTRANSFER_PAGE&tab=buy&version=1` (across `shopee.vn`, `shopee.co.th`, `shopee.sg`, `shopee.com.my`, `shopee.ph`, `shopee.co.id`) **without** `s.shopee.vn`'s `use_deeplink=1` or duplicated outer ULS web-shim parameters, so Shopee App opens natively (`_s === true`, `page_type=h5_inapp`, `document.referrer === ""`) and records `"Others"`.
  - **Standalone Mobile Safari** keeps the raw `https://shopee.vn/opaanlp/...` Universal Link directly (`LSAppLink`, `referrerURL = nil` -> `"Others"`).
- `lib/shopee-link.ts` (`isShopeeShortUrl`, `expandShopeeShortUrl`) sends `referrerPolicy: 'no-referrer'` and expands `s.shopee.*`, `shope.ee`, and `shp.ee` short links via `DESKTOP_SHORTENER_REDIRECT_UA` `301` redirect to `https://shopee.vn/opaanlp/...` on paste (`/api/content/resolve-affiliate`), on popup create/update (`POST /api/popups`, `PUT /api/popups/[id]`), and via a 5-minute server cache in `preparePopupSettingsForRequest` (`lib/popup-settings-server.ts`) for any legacy unexpanded popup across **both Android and iOS** (`isMobileUserAgent`), preventing `s.shopee.vn`'s mobile JS shim from redirecting with `Referer: https://s.shopee.vn/` (`stm_medium: "referral"` -> `"Website"`), while keeping `needsTikTokExpand` strictly iOS-only.
- `getTikTokIosLaunchUrl` and `preparePopupSettingsForRequest` wrap/resolve TikTok product and `vt.tiktok.com` / `vm.tiktok.com` short links into TikTok's first-party Universal Link (`https://www.tiktokv.com/redirect/?redirect_url=snssdk1180%3A%2F%2Fec%2Fpdp...&dl=<productUrl>&ug_source=Facebook&decode_once=1`) across all iOS user agents (`isIosUserAgent`).
  - Why: `www.tiktokv.com/.well-known/apple-app-site-association` registers `"/redirect*"` directly for `MJ797D8U6F.com.ss.iphone.ugc.Ame` and `MJ797D8U6F.com.zhiliaoapp.musically`, and setting `dl` to the signed `www.tiktok.com` product URL avoids navigating Facebook's iOS `WKWebView` to `snssdk1180.onelink.me` (which triggered Facebook's *"Tiếp tục truy cập trang web này? ... https://snssdk1180.onelink.me/"* warning dialog).
  - `buildTikTokOneLinkUrl` is also fixed to use `/BAuo/` (matching `{"/": "/BAuo/*"}` in `snssdk1180.onelink.me`'s AASA) plus `af_force_deeplink=true` (avoiding a `301` redirect to the regional App Store) as the `<= 8192` length fallback when an oversized signed query cannot fit in `redirect_url` + `dl`.
- Verify: `node scripts/test-popup-runtime.cjs --android-native-check`, `node scripts/test-popup-runtime.cjs`, and `node scripts/test-popup-affiliate.cjs`.

## Multi-OEM + Standard Chrome + `FB4A` Android app-link intent & HarmonyOS compatibility (2026-11-24)

- `isAndroidDeviceUserAgent` (`lib/popup-link.ts` / `isAndroidUserAgent` in `lib/popup-settings.ts`) also matches Huawei HarmonyOS / OpenHarmony mobile browsers (`/(?:harmonyos|openharmony).*(?:mobile|phone|arkweb)/i`).
- **Android Shopee (`SHOPEE_ANDROID_HOSTS` -> `package=com.shopee.vn`)**: `isAndroidShopeeIntentUserAgent` wraps the exact unmodified HTTPS `/opaanlp/` URL into a `scheme=https` Android `intent://` with `S.browser_fallback_url` set to the exact HTTPS URL and `_self` (`anchor-same-tab`) across **all Android browsers and WebViews including Facebook `FB4A`** (excluding only Presto `Opera Mini/`), even when `forceChromeAndroid === false`. This prevents `/opaanlp/` from loading inside `FB4A` WebView (`_s === false`, `page_type=h5`, `stm_medium=referral&stm_source=rw` -> `"Website"`) and keeps `params.getReferrerUrl().isEmpty() == true` in Chromium `ExternalNavigationHandler.java` (`Intent.EXTRA_REFERRER` unset -> `"Others"`).
- **Android TikTok (`TIKTOK_ANDROID_HOSTS` -> `package=com.ss.android.ugc.trill`)**: Keeps `isAndroidIntentBrowserUserAgent` (`scheme=https` `intent://` in `_self` on standalone/OEM browsers and non-`FB4A` webviews; raw HTTPS `_self` on `FB4A` when `forceChromeAndroid` is off). `step.url` always retains raw HTTPS for explicit `Mở liên kết web` fallback and unverified short domains (`shope.ee`, `shp.ee`).
