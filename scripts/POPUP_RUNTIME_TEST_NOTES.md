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
failed lookup retry, unchanged Android/Safari/custom iOS URLs, and Shopee return.
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
and navigates once, while ordinary clicks, zoom/resize and mobile keys do not.
The guard runs without an active popup and removes its listeners and pending
navigation on React unmount. The harness executes every inline script, not just
the first. Use `--device-check` for a focused check or `POPUP_TEST_ROOT` pointing
at the original snapshot with `--device-baseline` to record desktop Shopee/F12=none.
