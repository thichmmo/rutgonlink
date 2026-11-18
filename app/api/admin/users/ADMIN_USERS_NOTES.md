# Admin user API

User listing supports plan/status/login filters, sequential numeric-ID search and aggregate activity. User detail exposes operational history without returning password, API key or OAuth secrets. Mutations are validated, reason-required, soft-delete based and audited; owner/self destructive actions are blocked. Internal CUIDs remain route keys only.

Verification: exercise each PATCH action with owner/support roles, confirm audit rows, and confirm suspended/revoked sessions lose `/api/auth/session` user data.

Both read APIs now expose `popupClicksToday: { shopee, tiktok, total }` per user, independently of lifetime short-link clicks. `popupClicksTodayAsOf` and `popupClicksTimezone` describe the Vietnam-day snapshot. List aggregation is limited to the current page; detail aggregation is limited to the target user. Existing `users.read` authorization and secret redaction remain unchanged; successful read responses are private/no-store.

Verification: `node scripts/test-admin-popup-clicks.cjs` checks both API contracts, denied/missing/empty reads, selected-user scope, zero values and Vietnam midnight boundaries.

Both `GET /api/admin/users` and `GET /api/admin/users/[id]` also return `fbViralCollageEnabled` (resolved from `AppSetting` key `fb_viral_collage_users` plus implicit `ADMIN_EMAIL`/`owner`/`ops` admins), and `PATCH /api/admin/users/[id]` supports `action: 'set-fb-viral-collage'` (`users.write` permission, audited under `user.set-fb-viral-collage`). Verify with `node scripts/test-reaction-collage.cjs` and `node scripts/test-admin-popup-clicks.cjs`.
