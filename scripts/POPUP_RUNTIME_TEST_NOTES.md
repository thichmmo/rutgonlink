# Popup runtime regression tests

The harness also asserts absolute managed-post preview metadata; `test-content-media.cjs` separately verifies provider-aware video URL normalization.

Run `node scripts/test-popup-runtime.cjs`. The test transpiles the actual route and
React sources, compiles the rendered inline script, and executes both against
JSDOM with mocked navigation, storage failures and deterministic clocks. No
production requests or affiliate clicks are made.

Coverage includes DOM progress before navigation, mobile null handles, all-storage
failure, cookie-only reloads, completed handoffs, expiry, suspended countdowns,
desktop popup bypass, navigation exceptions, signed OneLinks and iOS field
preservation. The iPhone/Facebook Shopee case also verifies an attached hidden
`_blank` anchor is present during the click, removed afterward, and rolls back on a
click exception. Blur/focus-only return must unlock TikTok without a Back action,
while repeated taps during handoff remain blocked. It also verifies zero cooldown
reopens the popup on a fresh load, nonzero cooldown expiry across session/local/cookie
fallbacks, ignored legacy completion, and unchanged unrelated storage. It validates
application behavior, not iOS universal-link routing,
Facebook's native confirmation dialog, or the physical return page; those still need
an iPhone/Facebook test.

Short TikTok links are prepared on the server before either popup runtime mounts.
Tests mock the redirect to a signed product URL and assert it becomes the same
OneLink as a full product URL, without another network request on the click. They
also cover redirect validation, one deadline for the chain, cache coalescing/expiry,
failed lookup retry, unchanged Safari/custom iOS URLs, and Shopee return. Android
preparation has a separate source/cache and native-PDP contract below.
Run `node scripts/test-popup-runtime.cjs`; no external link is contacted by these tests.
Use `POPUP_TEST_ROOT` with `--shortlink-baseline` to reproduce the previous short
TikTok `new-tab` branch on a source snapshot.

For a historical baseline, set `POPUP_TEST_ROOT` to a source snapshot and pass
`--baseline`; this records the previous iPhone/Facebook Shopee `window.open`
mode before comparing it with the attached-anchor mode in the modified runtime.

For the cooldown regression, set `POPUP_TEST_ROOT` to a pre-fix source snapshot
and run `node scripts/test-popup-runtime.cjs --cooldown-baseline`. It reproduces
zero-minute suppression on revisit and permanent session completion. The normal
suite tests 0, 1, 5, 60 and 10080 minutes, exact expiry, reads that must not extend
deadlines, independent storage fallbacks, old handoff migration, and failed-launch
rollback. The cookie mock handles multiple cookies and their actual Max-Age.

Desktop cases assert ARTICLE with no popup storage reads/migration, including
old mobile handoff markers. F12 and Windows/macOS DevTools shortcuts navigate
once to `https://mesale.vn`; desktop right-click also suppresses the context menu
and navigates once, while ordinary clicks, proportional zoom, transient resize
and real-mobile keys do not.
The guard runs without an active popup and removes its listeners and pending
navigation on React unmount. The harness executes every inline script, not just
the first. Use `--device-check` for a focused check or `POPUP_TEST_ROOT` pointing
at the original snapshot with `--device-baseline` to record desktop Shopee/F12=none.

Preopened-panel coverage includes both dock positions, mobile UA on desktop
platforms, iPad desktop mode, hidden-page return, pending-click suppression and
timer cleanup. Both renderers must emit noscript HTML without an unconditional
refresh, and the standalone guard must run in the head. Use `--preopened-check`
for focused checks; `POPUP_TEST_ROOT` plus `--preopened-baseline` reproduces the
old bypass on a source snapshot. `--export-fixture <directory>` writes standalone
and React SSR fixture HTML for browser no-JS checks without production requests.


`node scripts/test-popup-timing.cjs` covers the dashboard timing formatter and legacy/default JSON normalization. It does not open affiliate URLs or mutate popup records; the dashboard preview uses the same wall-clock countdown semantics as the public runtime.

Timer baseline reproduction is explicit: set `POPUP_TEST_ROOT` to the original snapshot and use `--timer-baseline`. Normal test runs always require timer markup and fail if it disappears; no silent baseline skip is permitted. The timing API suite verifies authentication/owner filters and persisted settings using mocked database calls.

Popup click tracking is covered by `scripts/test-popup-clicks.cjs`; it verifies signed host-bound events and UTC+7 reporting windows without opening affiliate links.

The click suite also checks duplicate event delivery, bot/desktop exclusion,
rejected tokens/origins/payloads, keepalive delivery, account-scoped reporting and
the dashboard detail anchor. Runtime tests execute the real sender in both public
renderers: page views, countdown taps, repeated pending taps and app returns must
not create extra clicks. Tests only write to in-memory event stores.

Telegram render helpers are included in the source loader so ordinary and Telegram
post changes still exercise the existing popup/inspection runtime unchanged.
Verify: `node scripts/test-popup-runtime.cjs`.

## Android native links and foreground handoff

Run `node scripts/test-popup-runtime.cjs --android-native-check` (or
`--android-check`) for the focused Android Chrome/Facebook checks. The 2026-10-07
device diagnostic confirmed TikTok's `snssdk1180://ec/pdp` intent with package
`com.ss.android.ugc.trill` and Shopee's original HTTPS link in `_blank`. Regression
tests require the exact seven-field native construction and raw signed
`params_url`, with the original Android source encoded as browser fallback.
Shopee must remain raw HTTPS without wrapping in an HTTPS intent.

Android primary CTAs are visible real anchors: Shopee `_blank`, TikTok `_self`.
The harness dispatches the click through actual runtime handlers, then observes
whether default navigation remained permitted. It checks attachment, visibility,
same-anchor identity, persisted progress before navigation, and cancellation for
countdown/pending taps. Only the test observer prevents external JSDOM navigation.
This is not a trusted native-device click or evidence that an app opened.

Android short links resolve before rendering, not from a click handler. Tests
check independent Android/iOS fields and cache keys, coalescing, five-minute cache
expiry, brief failed-lookup caching, timeout/non-product fallback, direct products
without fetch, no network request on taps, request-only metadata validation and
normalization stripping. Absolute, relative and protocol-relative signed query
bytes survive unchanged. Invalid redirects, malformed UTF-16 and oversized native
links fall back without truncating the original source. Other coverage includes
countdowns, one count per accepted tap, cookie-only reload, zero cooldown, explicit
web-fallback exceptions and denied storage.

A pending Android launch keeps the clicked popup visible while native app-opening
confirmation is displayed. A 2500 ms wait without departure offers an explicit
app retry or original-web-link fallback on that same popup, without briefly
showing the next popup/article. The persisted next step remains intact for slow
launches. Only `visibilitychange` to hidden or `pagehide`, followed by return,
clears pending UI and resumes the next popup. Android blur/focus alone can be a
canceled native prompt and must not advance or consume the history-return marker.
iOS still supports blur/focus-only returns. No timeout launches another URL.
A separate expiring Android session marker covers zero-cooldown browser Back
when the article remounts without BFCache after the web fallback. Tests assert
that only a `back_forward` navigation consumes this completion once; fresh
navigation, reload and expiry remove it and still start with Shopee. Native
explicit web-fallback exceptions restore progress on both routes. The harness
mocks navigation, not Android's IntentResolver: these checks verify URI and state
contracts, not installed apps or Facebook's external-app confirmation. Physical
production verification remains separate from these deterministic checks.

Verification: `node scripts/test-popup-runtime.cjs --android-native-check` passed
38 scenarios; `node scripts/test-popup-runtime.cjs` passed 139 scenarios.
`--export-fixture <directory>` also emits `route-android.html` with a direct product
fixture and no external resolver request for trusted-browser default-action QA.

Use `POPUP_TEST_ROOT` with `--android-native-baseline` against commit `bc9fbd8` to
reproduce the old HTTPS-intent/hidden-anchor `_self` path for both platforms.
It is also the rollback assertion; `--android-native-check` validates the changed
construction. Baseline output and focused output explicitly retain native-device
status `UNVERIFIED` because Node mocks cannot establish a physical app launch.

For baseline/rollback evidence, set `POPUP_TEST_ROOT` to the original source
snapshot and run `node scripts/test-popup-runtime.cjs --android-baseline`. It
asserts the previous `window.open(..., '_blank')` path for both popup stages on
Android Chrome and Facebook. Clear `POPUP_TEST_ROOT` before modified/full tests.

Use `--android-prompt-baseline` against commit `3104b2d` to reproduce the previous
package-less TikTok URI, Android next-popup/article flash and mistaken
blur/focus-only confirmation.
The focused suite covers delayed acceptance, prompt cancellation, repeated focus,
explicit retry, real hidden/pagehide return and a preserved zero-cooldown marker.
