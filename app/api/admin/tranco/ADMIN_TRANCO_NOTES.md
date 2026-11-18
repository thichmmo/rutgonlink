# Admin Tranco Top-1M Booster API (`app/api/admin/tranco/route.ts`)

## Purpose
Admin-only endpoint (`system.read` / `system.write`) for viewing and updating the list of domains whose DNS/Edge popularity is warmed across public visitor pages (`AppSetting.key = "system_tranco_boost"`, defaulting to `honghotngay228.site` enabled).

## Behavior
- `GET` returns `{ enabled, domains, updatedAt, updatedBy, canWrite, targets, suggestedDomains }`.
- `PUT` validates hostnames, persists the normalized domain list (`max 10`), invalidates the in-memory config cache, and records `AdminAuditLog` (`system.tranco-boost.update`).
- Unauthenticated or non-admin callers receive `403 Forbidden`.

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `npx tsc --noEmit --pretty false`
