# Popup timing options

Return saved popup settings beside active, owner-scoped popup options so the post
editor previews the same countdown used by public posts. No settings are copied
onto the post. Verify with `node scripts/test-popup-timing-api.cjs`.

Telegram is independent of popup timing: `telegramDefaults` returns the normalized
current actor's saved default for new-post forms only. Existing post editors read
the post snapshot instead. Verify isolation with `node scripts/test-telegram-api.cjs`.
# Latest popup creation default (2026-10-07)

Active, owner-scoped popup options now use `createdAt DESC, id DESC`. New-post
forms can select the first refreshed option without inferring age from its name;
the deterministic tie-breaker also supports a deleted default falling back to
the latest remaining popup. Existing post selections are handled by the editor.

Verification: `node scripts/test-telegram-api.cjs` checks authentication,
owner/active scope, and this ordering contract.
