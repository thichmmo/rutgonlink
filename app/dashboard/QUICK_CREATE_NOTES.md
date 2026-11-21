# Dashboard Quick Shorten / Quick Telegram Post (`app/dashboard/DashboardQuickShorten.tsx`)

## Purpose
Renders the top banner on `/dashboard` in either classic URL-shortener mode (`shorten`) or instant Telegram video-post mode (`telegram-post`) based on the user's `/dashboard/settings` preference.

## Behavior
- In `telegram-post` mode, accepts direct video URLs (`MP4`/`WebM`/`OGG`), social embeds/`<iframe>` (`YouTube`, `TikTok`, `Facebook`, `Vimeo`, `Instagram`, `Google Drive`), public article URLs (via `/api/content/resolve-video`), or direct media uploads (`/api/content/upload`).
- Publishes immediately (`isPublished: true`, `publicLinkMode: 'numeric'`) using the user's most recently used active popup, saved `telegramDefaults`, and default post domain (`ca33newss.xyz`).
- Displays and copies the resulting post link stripped of `https://` (`ca33newss.xyz/p7/37325`) with its 5-digit code title, and dispatches `'popup-stats-refresh'`.

## Verification
- `node scripts/test-quick-telegram-and-post-ui.cjs`
