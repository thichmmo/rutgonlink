# Admin user detail

The detail page combines account state, plan, resources, payments and activity and shows the sequential public user ID instead of the internal CUID. All mutations require a reason; destructive actions are confirmed in a modal. Owner-only role management and API/session revocation are exposed without showing secret values.

Verification: run each action against a non-owner test user and confirm UI refresh plus audit rows.

The read-only popup section shows today's total, Shopee and TikTok CTA clicks from
`user.popupClicksToday`. Its snapshot timestamp is displayed in Vietnam time
(UTC+7); lifetime short-link clicks remain separately labeled in recent links.
`Cập nhật` performs a manual GET with no polling and retains unsaved plan, role,
reason and pending-action state. Load errors remain visible; a failed refresh
retains the previous timestamped snapshot, while missing metric fields show `—`
rather than invented zero values. Role initialization occurs only on the initial
load or after an explicit successful action.

Changing the route user ID immediately hides the previous snapshot/actions and
starts a fresh form session. Request generations discard out-of-order reads and
late action completion from the previous account; queued loads are canceled on
cleanup. This reset applies to navigation, while manual refresh preserves drafts.

Verify: `node scripts/test-admin-popup-clicks-ui.cjs` (list and detail, actual TSX
with in-memory GET fixtures), scoped ESLint and TypeScript.
No production data or admin mutation is used by this regression.
