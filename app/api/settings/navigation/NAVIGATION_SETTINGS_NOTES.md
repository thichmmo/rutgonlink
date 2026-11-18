# User Navigation Visibility API (`app/api/settings/navigation/route.ts`)

## Purpose
Authenticated user endpoint (`GET` / `PUT`) for reading and updating per-account visibility of optional Dashboard sidebar items (`links`, `folders`, `analytics`, `notes`, `fbDebug`).

## Behavior
- Scoped strictly to the authenticated active user (`getManagedContentActor()`), returning `401` when unauthenticated.
- Accepts partial boolean updates so single-switch toggles and bulk presets ("Gọn menu" / "Hiện tất cả") persist atomically per user.

## Verification
- `node scripts/test-dashboard-nav-visibility.cjs`
