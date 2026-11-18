# Admin Post Fallback API (`app/api/admin/post-fallback/route.ts`)

## Purpose
Admin-only endpoint (`system.read` / `system.write`) for managing the system-wide fallback destination of deleted or missing `/p7/<code>` and `/posts/<slug>` links.

## Behavior
- `GET` returns `{ enabled, targetUrl, updatedAt, updatedBy, canWrite, inspection, adminPosts }` so the Admin UI can display live target resolution status (`post` vs `redirect` vs `missing_post`) and offer one-click selection from the admin's published posts.
- `PUT` validates `targetUrl`, rejects enabling fallback onto a missing/unpublished internal post (`400`), persists the setting in `AppSetting` (`system_post_fallback`), and writes an `AdminAuditLog` entry (`system.post-fallback.update`).
- Unauthenticated or non-admin callers receive `403 Forbidden`.

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `npx tsc --noEmit --pretty false`
