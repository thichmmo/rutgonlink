# Telegram account defaults

`TelegramSettingsSection` is shared by Settings and the Posts toolbar dialog. It
loads and saves the authenticated account's `/api/settings/telegram` object, never
the active post form. Save is a `type="button"` action with separate status/error
feedback. A failed initial load blocks save until a successful retry, avoiding an
accidental overwrite with empty defaults.

`TelegramSettingsFields` edits enabled/link/button text/plain-text disclaimer.
Limits mirror server validation (URL 2048, button 120, disclaimer 4000). Settings
remain editable while the default toggle is off so a saved template can be enabled
later. Defaults affect future new forms only; existing posts retain their snapshot.

Verify `node scripts/test-telegram-dashboard.cjs` and scoped ESLint on both
Telegram components plus `page.tsx`. The existing unrelated `ProPlanModal.tsx`
anchor lint failure is not part of this change.

## Explicit post types

The enabled account value is retained as a preferred type and as the existing API
fallback. It no longer silently changes an explicitly created standard post. Copy
explains that separate standard/Telegram create buttons decide the post type, while
URL/button/disclaimer defaults are reusable by new Telegram drafts. The shared
fields accept `hideEnabledToggle` so a composer with a dedicated type selector
never offers a competing enable checkbox. Changing account defaults still leaves
existing posts and already-open drafts unchanged.

Verify with `node scripts/test-telegram-dashboard.cjs`,
`node scripts/test-post-types-dashboard.cjs`, and scoped ESLint.
