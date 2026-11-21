# Dashboard Quick Create Mode (`lib/dashboard-quick-mode.ts` & `lib/dashboard-quick-mode-server.ts`)

## Purpose
Manages per-user configuration (`shorten` vs `telegram-post`) for the quick-action banner on `/dashboard` and resolves the user's most recently used active popup for instant Telegram video-post publishing.

## Behavior
- Stores mode per user in `AppSetting` (`user_quick_create_mode:<userId>`), defaulting to `'shorten'`.
- `getMostRecentlyUsedActivePopup(userId)` queries the latest `ManagedPost` with an active `popup`, falling back to the user's newest active `PopupTemplate` if no post has used an active popup yet.

## Verification
- `node scripts/test-quick-telegram-and-post-ui.cjs`
