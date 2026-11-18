# Dashboard Navigation Visibility (`lib/dashboard-nav-visibility.ts` & `lib/dashboard-nav-visibility-server.ts`)

## Purpose
Allows each user to show or hide optional sidebar/navigation modules (`Links`, `Folders`, `Thống kê`, `Ghi chú`, `FB Debug`) from `/dashboard/settings` to declutter the workspace when only using Popups/Posts.

## Behavior
- Pure client-safe helpers live in `lib/dashboard-nav-visibility.ts`; Prisma persistence (`AppSetting` key `user_nav_prefs:<userId>`) lives in `lib/dashboard-nav-visibility-server.ts` so client components never import `@/lib/prisma` and no database schema migration is needed.
- Core destinations (`Tổng quan`, `TikTok AFF`, `Popups`, `Bài viết`, `Cài đặt`, `Admin`) always remain visible so users cannot lock themselves out of Settings.
- All 5 optional modules default to `true` until toggled off by the user.

## Verification
- `node scripts/test-dashboard-nav-visibility.cjs`
- `npx tsc --noEmit --pretty false`
