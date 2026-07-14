# Usage stats notes

## Purpose

Expose the current Vietnam-day click count for dashboard usage summaries.

## Behavior

- `GET /api/user/usage` returns `clicksToday` in addition to the existing monthly click count.
- The daily window uses Vietnam day boundaries from `lib/vn-time` so it matches the analytics dashboard date logic.
- Existing response fields remain unchanged for other dashboard pages.

## Verification

- Run scoped ESLint for `app/api/user/usage/route.ts`.
- Confirm `/api/user/usage` returns `clicksToday` for an authenticated user.
