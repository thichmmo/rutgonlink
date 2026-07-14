# Analytics performance notes

## Purpose

Reduce slow loads on `/dashboard/analytics` when a user has many click records.

## Behavior

- `GET /api/analytics` now aggregates daily clicks in SQL by Vietnam date instead of grouping raw timestamps in Prisma and reducing them in Node.
- The route resolves the user's link ids once, then filters `Click` directly by `linkId` to avoid repeated relation joins in every aggregate query.
- Analytics responses are cached in memory for 30 seconds per user, link, and day range to absorb refreshes and quick tab changes.
- The response shape stays unchanged for the dashboard UI.

## Verification

- Run scoped ESLint for `app/api/analytics/route.ts`.
- Compare production DB profiling: raw timestamp grouping produced thousands of rows, SQL day grouping returns one row per day.
