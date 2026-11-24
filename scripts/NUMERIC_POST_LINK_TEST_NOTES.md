# Numeric public link regression tests

Run `node scripts/test-numeric-post-links.cjs`. Real create/edit/duplicate handlers,
schemas, numeric/legacy routes and canonical metadata use a deterministic
transaction fixture. It checks opt-in compatibility, optional numeric slug,
distinct popup variant codes, global collisions, concurrent P2002 rollback and
bounded exhaustion, defaults outside retries, owner/domain guards and inactive or
missing articles never accessing short-link analytics. No real database is used.

The existing popup/Telegram render loaders include the pure public-path helper;
their old fixtures retain the same URL and popup behavior.

## Direct Wrapper, Admin Global Post Fallback, Tranco Booster & Default Post Domain Coverage (2026-11-18)

- `scripts/test-numeric-post-links.cjs` covers `isDirectWrapper: true` creation (verifying raw `https://shopee.vn/opaanlp/...` `_blank` anchor with `no-referrer` on Android and TikTok direct wrapper rendering), Admin-only `GET/PUT /api/admin/post-fallback` (`system_post_fallback`), Admin-only `GET/PUT /api/admin/tranco` (`system_tranco_boost`), and Admin-only `GET/PUT /api/admin/domains/default-post-domain` (`system_default_post_domain`, verifying `ca33newss.xyz` default and live propagation into `GET /api/posts/options` for all members).
- Verify: `node scripts/test-numeric-post-links.cjs` (19 scenarios).
