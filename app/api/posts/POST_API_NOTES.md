# Post API

Owner-scoped post endpoints support search/status/domain filters, 6/10/20/25 pagination, domain validation, one-or-many popup creation in a transaction, slug suffixes, rich/raw content permissions, preview image and fake-video settings, duplicate and delete. Post and option responses include the selected popup's persisted `settings` so the dashboard can show the exact Shopee/TikTok delays and cooldown beside each article without duplicating configuration. `/api/posts/options` exposes only active popups and verified publication domains.

Verify with `pnpm exec eslint app/api/posts` and authenticated no-popup, bulk-popup, duplicate-slug and invalid-domain requests.
