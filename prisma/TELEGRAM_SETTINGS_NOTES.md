# Telegram defaults and post snapshots

Migration `20261005000000_add_telegram_post_defaults` adds nullable JSON fields to
`User` and `ManagedPost`. NULL means disabled for existing accounts/posts; no data
backfill or implicit public-render inheritance occurs. New post creation snapshots
the current account default unless an explicit post setting is supplied.

The existing cPanel package includes every migration and its release runner applies
new migrations before the runtime swap. No packaging change is required. A code
rollback can leave these nullable additive columns intact without losing settings.

Verify schema with `pnpm exec prisma validate`, regenerate with
`pnpm exec prisma generate`, then `node scripts/test-telegram-api.cjs`.
