# Public managed post route

The root `domain/slug` route checks published managed posts before short links. It filters by primary/shared/verified custom domain, falls back to a primary publication for known shared-domain aliases when an older record has no explicit target, renders fixed content and complete absolute Open Graph/Twitter preview metadata, keeps `/posts/slug` as an alias, and runs the two-step popup in the current session only for mobile UAs. Desktop visitors see the article directly. The inline runtime commits the next step before opening an external URL, keeps a short-lived local-storage/cookie handoff for webviews that reopen a fresh tab, and resumes it through mobile page lifecycle events. Blur/focus signals cover webviews that keep `visibilityState` visible, while mobile null `window.open` results keep the committed step instead of replaying Shopee. If no post matches, the existing short-link flow is unchanged.
On iOS Facebook, a TikTok product URL is wrapped into a Boclink-compatible `snssdk1180.onelink.me` handoff with the original signed URL and tracking payload preserved, then navigated in the current tab. The asynchronous page builder prepares TikTok short links through the shared server helper before serializing popup steps, rather than awaiting a lookup on click. Supplied OneLinks stay intact; failed lookups retain the short link in the current tab. Shopee still uses the attached link action on iPhone/Facebook.

For iPhone/Facebook Shopee navigation, the runtime now clicks a hidden `_blank`
anchor instead of calling `window.open`; this is intended to avoid Facebook's
script-created blank return tab while keeping the next popup committed before
handoff. The native return still requires an iPhone/Facebook check.

Progress bars show the configured seconds for each inline popup step, and the action
stays disabled until its wall-clock deadline. Progress never moves backwards merely because storage reads fail or expire. An
unfinished first handoff carries a 30-minute resume window; completed state uses
the popup's configured cooldown, including zero. Returning refreshes the button
from its deadline, not a restarted countdown. Failed navigation restores the
overlay even after step two.

Session, local storage and the cookie use an absolute expiry. A completion record
also includes its configured duration, so legacy permanent/fixed-30m completion
records are ignored. Loading the article never renews the cooldown. Zero clears
persisted completion while the current document stays unlocked after TikTok returns.

The Facebook preview JPEG stays in Open Graph/Twitter metadata, not the article body.

Every standalone managed-post document embeds the shared inspection guard in the
head, before article markup and popup initialization, even without an active popup.
F12, desktop right-click, a persistent docked panel on entry and mobile UA/desktop
platform mismatch redirect to `https://mesale.vn`. Blocked clicks cannot record
popup events or open affiliate links. Real-mobile hints, proportional zoom and
transient resize are excluded; undocked DevTools is not reliably detected.
Noscript markup hides the article/popup and redirects via HTML meta refresh when
JavaScript is disabled. OG tags stay intact; dashboard and ordinary short-link
routes remain unchanged. See `lib/PUBLIC_POST_GUARD_NOTES.md` for heuristic limits.

Verify with `node scripts/test-popup-runtime.cjs` and `pnpm exec eslint 'app/[shortCode]/route.ts'`, plus mobile popup, desktop no-popup/F12, root-post metadata, alias and short-link smoke requests.

The header badge, visible timer and accessible 0-100 progress bar update together, including after returning from an external app. `node scripts/test-popup-runtime.cjs` executes the actual inline DOM to verify both steps and zero seconds.

## Telegram article template

Share-domain posts use the same escaped CTA/disclaimer and CSS as the React alias.
A valid enabled post snapshot activates it, not changing account defaults. The
privacy link points to the primary domain, and title/OG metadata stay intact.
Existing fixed blocks and popup scripts remain unchanged. Verify
`node scripts/test-telegram-render.cjs` and `node scripts/test-popup-runtime.cjs`.

## Android app handoff (historical implementation, 2026-10-07)

Android Facebook and Chrome use an attached `_self` anchor, synchronously within
one user tap, rather than `window.open` or `location.replace`. `getPopupStep`
keeps the original affiliate `url` separate from its Android `launchUrl`; saved
Android/iOS settings are never changed by public-page rendering. Verified vendor
hosts use an HTTPS Android intent with an encoded original web fallback.

Android holds the clicked popup while waiting for browser confirmation.
A quiet webview after 2.5 seconds enables explicit native retry and “Mở liên kết web”. This is not proof of failure: persisted progress stays
at the next step so a delayed pagehide/app return still resumes correctly. Only
thrown navigation restores persisted progress. No timer launches another URL.
The direct web fallback also stays in the current tab to preserve back history.
The iOS handoff paths, cooldown and accepted-click analytics remain unchanged.

Verify `node scripts/test-popup-runtime.cjs --android-check`, then the full runtime
and affiliate suites. These tests verify URLs, gesture timing, DOM/storage and
return events; real Android app opening requires Facebook/Chrome device testing.

For zero cooldown, a separate one-use session marker restores Android completion
only on `back_forward` navigation after a same-tab fallback without BFCache.
Fresh visits/reloads clear it; expiry remains bounded by the handoff TTL.

## Android consent-dialog correction (2026-10-07)

Android persists the next step before a tap-triggered launch but keeps the clicked
popup visible, including step two. Timeout enables retry in place; it does not
flash the article or another popup and never launches automatically. Native
Facebook confirmation may only blur/focus: those events neither finish the step
nor consume the zero-cooldown history marker. Actual hidden/pagehide followed by
return shows the next step. iOS keeps its existing blur/focus snapshot behavior.
Shopee's launch URL is unchanged (confirmed on the user's device after Continue).
Verify `node scripts/test-popup-runtime.cjs --android-check` and full runtime;
`--android-prompt-baseline` reproduces the prior flash/prompt-focus regression.


## Android native launch parity (2026-10-07)

Historical native-intent implementation; superseded for the public Android TikTok
action by the Chrome gate and original HTTPS selection below.

- Standalone public popup uses a visible real anchor for Android primary actions, matching the phone-confirmed diagnostic: Shopee original HTTPS in `_blank`; TikTok native PDP intent in `_self`. The handler persists progress and records the accepted click synchronously, then lets the anchor navigate normally.
- Countdown, repeated taps and blocked guards cancel default navigation. Android keeps the current popup pending regardless of anchor target; blur alone does not advance. A genuine departure/return resumes the next step; retries retain the original web URL. iOS launch paths remain unchanged.
- The inline renderer updates the existing anchor instead of detaching it before default navigation. React retains the same anchor while holding the clicked step.
- Verification: `node scripts/test-popup-runtime.cjs --android-native-check`, the full runtime suite, click/affiliate regressions, ESLint and TypeScript. Physical user confirmed the isolated native TikTok link opens the correct product in Chrome Android and original Shopee HTTPS opens the app directly in Facebook. Integrated production flow still needs its own deployment check.

## Android Facebook Chrome gate (2026-10-07)

The standalone script branches before creating a popup or reading progress when
`forceChromeAndroid` is enabled for an active applicable Android Facebook popup
with a TikTok source. It displays a real `_self` Chrome anchor to
`window.location.href`, preserving the current article path, query and fragment.
The gate does not start a timer, send affiliate analytics, mutate storage or
complete either step. It stays available after canceled consent or Facebook Back.

Chrome loads the ordinary sequence in its own browser storage. Android TikTok
uses the original Android HTTPS source; Shopee and iOS retain their existing
selection. No transferred step is invented. Verify both actual renderer gate
isolation plus countdown/return/cooldown/analytics using
`node scripts/test-popup-runtime.cjs` (143 scenarios), focused
`--android-native-check` (42 scenarios), scoped ESLint and TypeScript.

On 2026-10-07, four isolated HTTPS trials passed on the connected Android 16
phone: both renderers through Facebook→same-article Chrome and directly through
Chrome. Facebook's native Chrome confirmation stayed enabled and was approved
by the human. Shopee opened its native offers landing. TikTok opened the correct
T20 shared card; a separate native **Xem mặt hàng** tap opened the complete PDP.
Return showed TikTok after Shopee and the article after TikTok without a blank
page/replay. Countdown and cooldown-zero reload checks passed; each original
trial recorded one Shopee and one TikTok click in the isolated receiver. All six
tested source hashes matched. iOS was automated-only; this does not establish
production analytics or deployment success.
