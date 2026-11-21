# Menu Visibility Settings (`app/dashboard/settings/MenuVisibilitySection.tsx`)

## Purpose
Card inside `/dashboard/settings` allowing users to individually toggle (`Links`, `Folders`, `Thống kê`, `Ghi chú`, `FB Debug`) or apply one-click presets (`Ẩn gọn cả 5 mục` / `Hiện tất cả`).

## Behavior
- Hydrated server-side from `SettingsPage` (`getUserDashboardNavVisibility`) so switches render immediately without a loading spinner.
- Dispatches `dashboard-nav-updated` optimistically and persists to `PUT /api/settings/navigation`, rolling back UI state if the network request fails.
- Lists `Ghép ảnh` alongside `Bài viết`, `Popup`, and `Link TikTok` in the always-pinned core section note.

## Verification
- `node scripts/test-dashboard-nav-visibility.cjs`
- `npx eslint app/dashboard/settings/MenuVisibilitySection.tsx app/dashboard/settings/page.tsx`

- Updated (2026-11-21): `TikTok AFF` (`tiktokAff`) is now included in the optional toggle list (`Ẩn gọn cả 6 mục` / `Hiện tất cả`), leaving `Tổng quan`, `Popups`, `Bài viết`, `Ghép ảnh`, and `Cài đặt` as always-pinned core items.
