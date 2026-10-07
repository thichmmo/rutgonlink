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
click exception. On iOS, blur/focus-only return must unlock TikTok without a Back action,
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
preparation preserves its original source without a lookup; see the Android checks below.
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

## Android HTTPS links, browser transfer and foreground handoff

Run `node scripts/test-popup-runtime.cjs --android-native-check` (or
`--android-check`) for the focused suite. Both renderer fixtures explicitly keep
`forceChromeAndroid=false` for ordinary affiliate sequencing. Android TikTok uses
the exact saved Android HTTPS source in `_self`; Shopee stays raw HTTPS in
`_blank`. Android preparation performs no network lookup, strips stale
`androidLaunchUrl` metadata without mutating settings, and preserves independent
iOS fields. Legacy native builders remain syntax/byte-preservation compatibility
checks; a passing builder test does not establish a successful device PDP.

The opt-in Android Facebook gate is tested separately in both renderers. Its
visible attached anchor transfers the actual article alias, scheme, query and
fragment to Chrome without a fallback URL. Loading it, tapping it, canceling a
prompt, blur/focus or departure/return must not read/write affiliate progress,
start countdown/retry timers or record affiliate clicks. Ordinary Chrome, iOS,
inactive/disabled popups and the disabled flag retain their existing flows. A
separate Chrome continuation test verifies that the article starts its own
countdowns and Shopee → TikTok sequence only on subsequent user taps.

The harness dispatches real DOM handlers before observing whether default anchor
navigation remained permitted. Its observer alone suppresses external JSDOM
navigation; these are not trusted native-device clicks. It verifies visibility,
attachment, pending-tap suppression, raw query preservation, analytics counts,
countdown, retry and cooldown zero, while preserving the existing iOS regression
coverage. No live affiliate link is fetched or opened by this suite.

A pending Android affiliate launch keeps its current popup until hidden/pagehide
and return. Blur/focus alone cannot advance it. The 2500 ms timeout offers an
explicit retry/web fallback without automatically launching another URL. An
expiring session marker covers cooldown-zero browser Back without BFCache;
fresh navigation, reload and expiry must still start with Shopee.

Verification commands: `node scripts/test-popup-runtime.cjs --android-native-check`
passed 42 scenarios; `node scripts/test-popup-runtime.cjs` passed 143 scenarios.
These results are runtime/URI checks;
physical Facebook confirmation, app product loading and hosting deployment need
separate evidence.

Separate real-phone evidence on 2026-10-07 passed four isolated HTTPS trials:
standalone/React from Facebook→same-article Chrome and directly in Chrome.
The human approved the retained Facebook Chrome prompt; native Shopee offers and
the correct TikTok T20 shared card/PDP opened (PDP required native **Xem mặt hàng**).
Return, countdown and cooldown-zero reload passed, with one accepted click per
affiliate in each original trial. This does not turn synthetic events into
trusted gestures or establish production database/commission results; iOS was
automated-only.

Historical reproductions still use `POPUP_TEST_ROOT` plus `--android-baseline`,
`--android-native-baseline` (commit `bc9fbd8`) or `--android-prompt-baseline`
(commit `3104b2d`). Clear `POPUP_TEST_ROOT` for current-source verification.
The historical flags do not describe the new HTTPS or Chrome-gate behavior.
