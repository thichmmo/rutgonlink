# Numeric public link regression tests

Run `node scripts/test-numeric-post-links.cjs`. Real create/edit/duplicate handlers,
schemas, numeric/legacy routes and canonical metadata use a deterministic
transaction fixture. It checks opt-in compatibility, optional numeric slug,
distinct popup variant codes, global collisions, concurrent P2002 rollback and
bounded exhaustion, defaults outside retries, owner/domain guards and inactive or
missing articles never accessing short-link analytics. No real database is used.

The existing popup/Telegram render loaders include the pure public-path helper;
their old fixtures retain the same URL and popup behavior.

## Direct Wrapper & Admin Global Post Fallback Coverage (2026-11-18)

- `scripts/test-numeric-post-links.cjs` covers `isDirectWrapper: true` creation (empty content, required popup, `/p7/<code>` allocation, `data-direct-wrapper=""` HTML rendering, duplication) and Admin-only `GET/PUT /api/admin/post-fallback` (`system_post_fallback`) routing missing `/p7/<code>` and `/posts/<slug>` paths across system domains to the Admin's internal post (with `history.replaceState` and loop prevention if unpublished) or `302` external URL, while keeping unknown hosts at `404` and recording `AdminAuditLog` entries.
- Verify: `node scripts/test-numeric-post-links.cjs` (16 scenarios).
