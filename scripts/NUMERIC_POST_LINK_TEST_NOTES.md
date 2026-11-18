# Numeric public link regression tests

Run `node scripts/test-numeric-post-links.cjs`. Real create/edit/duplicate handlers,
schemas, numeric/legacy routes and canonical metadata use a deterministic
transaction fixture. It checks opt-in compatibility, optional numeric slug,
distinct popup variant codes, global collisions, concurrent P2002 rollback and
bounded exhaustion, defaults outside retries, owner/domain guards and inactive or
missing articles never accessing short-link analytics. No real database is used.

The existing popup/Telegram render loaders include the pure public-path helper;
their old fixtures retain the same URL and popup behavior.

## Direct Wrapper, Admin Global Post Fallback & Tranco Top-1M Booster Coverage (2026-11-18)

- `scripts/test-numeric-post-links.cjs` covers `isDirectWrapper: true` creation, Admin-only `GET/PUT /api/admin/post-fallback` (`system_post_fallback`), and Admin-only `GET/PUT /api/admin/tranco` (`system_tranco_boost`, verifying default `honghotngay228.site` DNS/Edge beacon emission on `ca33newss.xyz`, self-ping suppression on `honghotngay228.site`, strict crawler isolation for `facebookexternalhit` / `meta-externalagent`, and multi-domain updates).
- Verify: `node scripts/test-numeric-post-links.cjs` (17 scenarios).
