# Admin Default Post Domain API (`app/api/admin/domains/default-post-domain/route.ts`)

## Purpose
Admin-only endpoint (`domains.read` / `domains.write`) to read and update the system-wide default domain pre-selected for all members when creating new posts (`Tạo bài thường`, `Tạo Bọc thẳng`, `Tạo bài Telegram`).

## Behavior
- `GET` returns `{ defaultDomain, updatedAt, updatedBy, canWrite, options }`.
- `PUT` validates against `SHARED_DOMAINS` + primary site hostname, persists in `AppSetting` (`system_default_post_domain`), and records `AdminAuditLog` (`domains.default-post-domain.update`).
- Unauthenticated or unauthorized requests return `403 Forbidden`.

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `npx tsc --noEmit --pretty false`
