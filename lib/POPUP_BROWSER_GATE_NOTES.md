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
