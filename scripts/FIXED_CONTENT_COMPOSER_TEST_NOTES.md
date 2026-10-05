# Fixed-content composer regressions

Run `node scripts/test-fixed-content-composer.cjs` (59 assertions).
The JSDOM harness executes the actual post composer, fixed-content manager,
summary and Telegram components with in-memory authenticated API fixtures.
No production post or reusable block is created.

Coverage: create/edit discoverability; active before/after summaries; explicit
account-wide semantics; independent block forms and overlay order; create,
edit and disable block refresh; unsaved title/description/media/Telegram
snapshot and editor lifetime preservation; focus trap/return, inert background
and busy-save close guards; no duplicate fixed blocks in saved post content;
isolated block-load errors, empty state and stale summary-response suppression.
Late initial manager GET success/error responses cannot overwrite the newer
post-save list or introduce an outdated error after a successful mutation.

To reproduce the old UI against an extracted source snapshot, set
`FIXED_CONTENT_TEST_ROOT` to that directory and pass `--baseline`. It asserts
that the old toolbar control exists but the create modal has no shortcut.
Also run `node scripts/test-telegram-dashboard.cjs` for upload and snapshot
regressions. CI must install a JSDOM navigator before loading React on Node 20.
