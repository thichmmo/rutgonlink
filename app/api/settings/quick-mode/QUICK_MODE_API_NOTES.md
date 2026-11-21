# Quick Create Mode Settings API (`app/api/settings/quick-mode/route.ts`)

## Purpose
Authenticated endpoint (`GET` / `PUT`) storing each user's preferred mode (`shorten` vs `telegram-post`) for the top quick-action box on `/dashboard`.

## Behavior
- `GET` returns `{ mode, telegramConfig }` (`Cache-Control: private, no-store`), including the user's most recently used active popup (`getMostRecentlyUsedActivePopup`), default post domain, and saved `telegramDefaults`.
- `PUT` validates `{ mode: 'shorten' | 'telegram-post' }` strictly and persists per user in `AppSetting` (`user_quick_create_mode:<userId>`).

## Verification
- `node scripts/test-quick-telegram-and-post-ui.cjs`
