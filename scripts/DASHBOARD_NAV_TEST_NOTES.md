# Dashboard Navigation Visibility Tests (`scripts/test-dashboard-nav-visibility.cjs`)

## Purpose
Verifies per-user isolation on `GET/PUT /api/settings/navigation` and live React/DOM synchronization across `DashboardNavLinks`, `MobileNav` (drawer + bottom bar), `CreateLinkButton`, and `MenuVisibilitySection`, including optimistic rollback on failed saves.

## Verification
- `node scripts/test-dashboard-nav-visibility.cjs`
