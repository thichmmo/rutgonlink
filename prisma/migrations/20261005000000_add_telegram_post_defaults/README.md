# Additive Telegram settings migration

Adds `telegramSettings` JSON NULL to `User` and `ManagedPost`. Existing rows stay
NULL/disabled; the app snapshots defaults only when a new post is created. Apply
before deploying the generated Prisma client. Keep columns when rolling application
code back; dropping them would discard saved account and post settings.

Verification: `pnpm exec prisma validate`, `pnpm exec prisma generate`, and the
Telegram API fixture suite; production migration success is recorded by the
existing cPanel release runner.
