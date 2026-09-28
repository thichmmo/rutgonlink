# Popup runtime regression tests

Run `node scripts/test-popup-runtime.cjs`. The test transpiles the actual route and
React sources, compiles the rendered inline script, and executes both against
JSDOM with mocked navigation, storage failures and deterministic clocks. No
production requests or affiliate clicks are made.

Coverage includes DOM progress before navigation, mobile null handles, all-storage
failure, cookie-only reloads, completed handoffs, expiry, suspended countdowns,
desktop popup blocking, navigation exceptions, signed OneLinks and iOS field
preservation. It validates application behavior, not iOS universal-link routing or
Facebook's native confirmation dialog; those still need an iPhone/Facebook test.

For a historical baseline, set `POPUP_TEST_ROOT` to a source snapshot and pass
`--baseline`; this asserts the old storage-denied replay and web TikTok URL.
