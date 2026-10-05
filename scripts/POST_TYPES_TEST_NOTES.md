# Separate post-type dashboard coverage

Run `node scripts/test-post-types-dashboard.cjs` (78 deterministic assertions).
This executes actual TSX in JSDOM with in-memory API fixtures, without live
posts, uploads, database access, or media requests. It installs a JSDOM
navigator for Node 20 and newer runtimes.

Coverage: independent standard/Telegram create entries; explicit type takes
precedence over both enabled and disabled account defaults; hidden Telegram
fields on standard posts; saved link/button/disclaimer snapshots; legacy null
settings; mode changes retain draft title, slug, body, popup, Facebook preview,
fixed-content summary and rich-editor identity. Telegram, preview, editor
uploads and saving disable mode changes. Saved payloads retain type and content.
Mutation mocks use the real Telegram settings schema: active invalid settings
retain the draft with validation feedback, while switching to standard preserves
the unfinished draft but sends a valid disabled payload. Valid disabled snapshots
keep their saved link, button and disclaimer.

List fixtures test server-side type query, page reset, server total, pending
filter race success/error, current-filter failure clearing incompatible rows,
retry retaining the filter, obsolete error removal, and strict boolean badges.
Filtering creates no post mutations. API classification/pagination/security
are covered separately by the API regression suite.

Baseline/rollback reproduction: set `POST_TYPES_TEST_ROOT` to an extracted
source snapshot, then run `node scripts/test-post-types-dashboard.cjs --baseline`.
It verifies the old combined creation control, inherited Telegram default and
missing type filters (5 assertions).

Also run `node scripts/test-telegram-dashboard.cjs` and
`node scripts/test-fixed-content-composer.cjs` to guard the earlier Telegram
upload lifetime and reusable content behavior in the new separate composer modes.
