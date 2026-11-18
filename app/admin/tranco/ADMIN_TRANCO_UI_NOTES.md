# Admin Tranco Top-1M UI (`app/admin/tranco/page.tsx`)

## Purpose
Admin-only page (`/admin/tranco`) to manage the domains being warmed into the global Tranco Top-1M list (starting with `honghotngay228.site` enabled by default, plus one-click suggestions such as `mesale.vn`).

## Behavior
- Reads and updates `/api/admin/tranco` (`system.read` / `system.write`).
- Shows active beacon URLs (`/t.gif?d=YYYYMMDD` on internal domains, `/favicon.ico?d=YYYYMMDD` on external domains) and keeps the feature completely invisible to regular dashboard users.

## Verification
- `npx tsc --noEmit --pretty false`
- `npx eslint app/admin/tranco app/api/admin/tranco`
