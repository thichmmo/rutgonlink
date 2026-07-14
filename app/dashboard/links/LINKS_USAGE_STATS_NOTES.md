# Links usage stats notes

## Purpose

Show today's click count in the links dashboard usage banner.

## Behavior

- The links page reads `clicksToday` from `/api/user/usage`.
- The banner now shows link quota, today's clicks, and this month's clicks.
- The table and filters are unchanged.

## Verification

- Run scoped ESLint for `app/dashboard/links/page.tsx`.
- Load `/dashboard/links` and confirm the usage banner includes `Clicks hom nay`.
