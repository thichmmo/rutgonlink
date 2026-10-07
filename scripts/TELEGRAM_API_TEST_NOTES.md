# Telegram API regressions

Run `node scripts/test-telegram-api.cjs`: 18 deterministic scenarios exercise the
real schema and route handlers with authentication/storage fixtures. Covers URL and
plain-text bounds, legacy normalization, auth and admin tenant isolation, account
settings, options, create/default snapshots, bulk creation, explicit-off settings,
omitted updates, duplicates, and keeping existing snapshots after default changes.
It does not mutate a database or claim live authentication/browser coverage.

Popup options now additionally assert newest-first `createdAt DESC, id DESC`
ordering while retaining active/owner filtering for new-post defaults.

The popup timing API harness also supplies a NULL Telegram account default so its
existing assertions continue exercising the modified post/options handlers.
