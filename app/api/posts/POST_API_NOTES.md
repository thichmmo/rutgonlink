# Post API

Owner-scoped post endpoints support search/status/domain filters, 6/10/20/25 pagination, domain validation, one-or-many popup creation in a transaction, slug suffixes, rich/raw content permissions, preview image and fake-video settings, duplicate and delete. Post and option responses include the selected popup's persisted `settings` so the dashboard can show the exact Shopee/TikTok delays and cooldown beside each article without duplicating configuration. `/api/posts/options` exposes only active popups and verified publication domains.

Verify with `pnpm exec eslint app/api/posts` and authenticated no-popup, bulk-popup, duplicate-slug and invalid-domain requests.

Telegram: POST accepts an explicit `telegramSettings` snapshot or copies the current
owner's account default when omitted. Every bulk popup variant receives the same
snapshot. PUT omission preserves the existing value; duplication copies the source
value, including legacy NULL. Account-default updates never modify old posts.
Verify with `node scripts/test-telegram-api.cjs` (18 scenarios).

Post list types: `GET /api/posts?type=all|standard|telegram` filters the stored
snapshot's strict JSON `enabled: true` before both count and pagination. Missing
or unknown types preserve the all-posts API. Standard includes legacy database
NULL, JSON null, absent enabled, false, and non-boolean values; a separate
`Prisma.AnyNull` JSON-path branch is necessary because SQL NOT alone drops NULL.
The filter is ANDed with owner, text, publication status and domain filters.
No schema migration or account-default lookup is involved. Verify with
`node scripts/test-post-types-api.cjs`, including installed Prisma MySQL SQL compilation.

## Numeric links for new Telegram posts

POST accepts the create-only opt-in `publicLinkMode: "numeric"` and permits an
omitted slug in that mode. An enabled Telegram snapshot is required. It creates
an internal globally unique `p7-<five-digit code>` slug, exposing
`https://<selected-domain>/p7/<code>` through `publicUrl`. Clients without the flag
keep their submitted slug; standard posts and PUT do not allocate codes.

Each bulk popup variant gets its own code in one transaction. A concurrent
unique-key collision rolls back the complete batch before a bounded retry;
account snapshots and content normalization remain outside the retries.
No schema/migration or stored settings changes are required. Verify with
`node scripts/test-numeric-post-links.cjs` and existing Telegram/type suites.

## Direct Wrapper (`type=direct` & `isDirectWrapper`, 2026-11-18)

- `GET /api/posts?type=direct` filters `isDirectWrapper: true`, while `telegram` and `standard` filter `isDirectWrapper: false` so the three types are mutually exclusive.
- `POST /api/posts` allows `isDirectWrapper: true` with empty `content` (`""`) and `publicLinkMode: 'numeric'`, forces `telegramSettings.enabled: false`, and requires at least one active owned popup (`popupIds.length > 0`).
- Verify: `node scripts/test-post-types-api.cjs` and `node scripts/test-numeric-post-links.cjs`.
