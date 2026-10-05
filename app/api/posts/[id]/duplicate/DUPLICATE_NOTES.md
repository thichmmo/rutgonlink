# Telegram duplication

Copy the source post's Telegram snapshot, not the account's current default. A
legacy NULL is written as Prisma `DbNull`, keeping old posts disabled even when
the account has since enabled Telegram. The source lookup remains owner-scoped.

Verify: `node scripts/test-telegram-api.cjs` covers enabled and NULL duplication,
cross-tenant rejection, and draft status on copied posts.
