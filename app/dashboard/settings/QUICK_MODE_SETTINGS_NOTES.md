# Quick Create Mode Settings (`app/dashboard/settings/QuickCreateModeSection.tsx`)

## Purpose
Allows each user to switch the top quick-action banner on `/dashboard` between `Rút gọn link nhanh` (`shorten`) and `Tạo nhanh bài Telegram (URL video / mã iframe)` (`telegram-post`).

## Behavior
- Hydrated server-side in `SettingsPage` (`getUserDashboardQuickMode`) and saves immediately via `PUT /api/settings/quick-mode` with optimistic UI and automatic rollback on failure.

## Verification
- `node scripts/test-quick-telegram-and-post-ui.cjs`
