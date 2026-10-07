# Admin users UI

The user table supports debounced search and status/plan/login filters, displays sequential `#numericId`, exposes operational counts and links to a dedicated detail page. Destructive actions are intentionally kept out of the list to reduce misclick risk.

Verification: filter combinations preserve pagination and every result opens the correct user detail.

## Today's popup clicks

Each user has a separate `Click popup hôm nay` column with total, Shopee and TikTok counts from `PopupClick`; the existing `clickCount` remains clearly labeled as lifetime short-link clicks. The API snapshot covers Vietnam midnight through `popupClicksTodayAsOf`, displayed with the explicit `Asia/Ho_Chi_Minh` timezone regardless of the browser's timezone. Real zeros are displayed; missing statistics show `Chưa có dữ liệu`. `Cập nhật` reloads the current filtered page manually without polling or changing pagination. Read permissions and existing user navigation/actions remain unchanged.

A request sequence invalidates earlier filter/page/refresh reads, including delayed JSON, errors and loading completion. Effect cleanup also invalidates in-flight responses and prevents queued loads after unmount, so a stale snapshot cannot replace counts for the current filters.

Verify: `node scripts/test-admin-popup-clicks-ui.cjs`, scoped ESLint and combined TypeScript/build. Test with different per-user platform counts, zero/missing statistics, refresh, filters/pagination and UTC+7 snapshot display.

Browser verification used the actual list/detail TSX with isolated in-memory GET
fixtures: per-user values, zero/unavailable rows, search retained on refresh, and
detail refresh were visually verified. No production accounts or events changed.
