# Android Facebook browser gate

When an active applicable popup has an Android TikTok URL and
`forceChromeAndroid` is enabled, Facebook Android displays a Chrome handoff before
either affiliate step. Ordinary Chrome, iOS, desktop, inactive popups and disabled
settings keep their existing applicability. Both renderers use
`shouldGatePopupToChrome` and the same `buildChromeBrowserLaunchUrl` helper.

The visible `_self` anchor targets Chrome with the actual document URL, including
the alias, query and fragment. It has no automatic launch, affiliate analytics,
storage mutation or popup completion. Browser storage remains browser-specific;
the gate does not invent transferred progress or consume old Facebook progress.

Android TikTok steps now launch the exact saved Android HTTPS source, with a
visible `_self` anchor. Request preparation does not resolve that source or derive
an `ec/pdp` intent; stale `androidLaunchUrl` metadata is stripped and ignored.
This preserves the affiliate query and the independent iOS source/resolution.
TikTok can show its shared-item card first, requiring the native **Xem mặt hàng**
gesture to view the PDP. The retained native builders are compatibility helpers,
not evidence that their PDP opens correctly on the device. Shopee keeps its
original HTTPS `_blank` anchor and the existing sequence/return state handling.

The builder is self-contained because the standalone route embeds its function
source. It accepts only HTTP(S) document URLs without credentials. Android's
[Intent parser](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/content/Intent.java)
uses the final `#Intent;` delimiter, leaving an earlier article fragment in the
data URL. The anchor retains the user gesture required by
[Chrome Android intents](https://developer.chrome.com/docs/android/intents).
There is no same-article fallback loop.

Verify helper URL/eligibility cases and both actual renderer gate isolation with
`node scripts/test-popup-runtime.cjs` (143 scenarios), focused
`--android-native-check` (42 scenarios), then scoped ESLint and TypeScript.

On 2026-10-07, four isolated HTTPS trials passed on the connected Samsung
SM-A175F / Android 16: standalone and React from Facebook→Chrome, and both
renderers directly in Chrome. Facebook's native Chrome confirmation was retained
and approved by the human user. Both affiliate links opened native apps; Shopee
showed its offers landing, and TikTok showed the correct T20 shared card followed
by a separate native **Xem mặt hàng** tap to its full PDP. Each original trial
captured one Shopee and one TikTok click, resumed the same article without a
blank page/Shopee replay, and restarted locked Shopee on cooldown-zero reload.
The tested six source hashes matched the fixtures. These were isolated fixture
analytics, not production database or commission validation; iOS was covered by
automated regressions only. Production deployment verification remains separate.

## Multi-app Android & iOS WebView browser gates (`forceChromeAndroid` + `forceSafariIos`, 2026-11-24)

- `shouldGatePopupToChrome` (`ANDROID_IN_APP_WEBVIEW_PATTERN`) gates restricted Android social/chat in-app webviews when `forceChromeAndroid` is enabled: Facebook (`FB4A`, `FBAN`, `FBAV`, `FB_IAB`, `FBLite`), Messenger (`Orca-Android`, `Messenger`), Instagram (`Instagram`), Threads (`Barcelona`), Zalo (`Zalo`), TikTok (`BytedanceWebview`, `musical_ly`), Telegram (`Telegram-Android`), and LINE (`Line/`), while leaving standalone Android browsers untouched.
- Alongside `[data-popup-chrome-link]` (`package=com.android.chrome`), `buildSystemBrowserLaunchUrl` renders a package-free `[data-popup-system-browser-link]` (`intent://<article>#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`) so Huawei HMS / HarmonyOS, China-ROM Xiaomi/Vivo/OPPO, and disabled-Chrome phones open their installed default system browser without timers, storage mutations, or fallback loops.
- `shouldGatePopupToSafari` + `buildSafariBrowserLaunchUrl` gate captive iOS `WKWebView`s (`IOS_IN_APP_WEBVIEW_PATTERN`) when `forceSafariIos` is enabled, rendering `[data-popup-safari-link]` (`x-safari-https://<article>?_fbh=<token>#<fragment>`) so Mobile Safari continues the popup sequence with native Universal Links (`LSAppLink`, `referrerURL = nil` -> `"Others"`), while standalone Mobile Safari skips the gate.
- When `onlyFromFacebook` is enabled (`true` by default), both `shouldGatePopupToChrome` and `shouldGatePopupToSafari` gate only confirmed Facebook visits (`options.isFacebookSource`), appending the host-bound HMAC `_fbh` query token before `#fragment` without re-serializing existing query bytes.
- Verify: `node scripts/test-popup-runtime.cjs --android-native-check` (52 scenarios) and `node scripts/test-popup-runtime.cjs` (148 scenarios).
