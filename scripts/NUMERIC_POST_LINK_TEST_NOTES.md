# Numeric public link regression tests

Run `node scripts/test-numeric-post-links.cjs`. Real create/edit/duplicate handlers,
schemas, numeric/legacy routes and canonical metadata use a deterministic
transaction fixture. It checks opt-in compatibility, optional numeric slug,
distinct popup variant codes, global collisions, concurrent P2002 rollback and
bounded exhaustion, defaults outside retries, owner/domain guards and inactive or
missing articles never accessing short-link analytics. No real database is used.

The existing popup/Telegram render loaders include the pure public-path helper;
their old fixtures retain the same URL and popup behavior.

## Direct Wrapper & Anti-404 `/p7` Fallback Coverage (2026-11-18)

- `scripts/test-numeric-post-links.cjs` covers `isDirectWrapper: true` creation (empty content, required popup, `/p7/<code>` allocation, `data-direct-wrapper=""` HTML rendering, duplication) and `PUT /api/settings/post-fallback` (`numericFallbackEnabled`) routing missing `/p7/99999` paths to the newest published post on the same host with `history.replaceState` while keeping other domains and disabled accounts at `404`.
- Verify: `node scripts/test-numeric-post-links.cjs` (16 scenarios).
