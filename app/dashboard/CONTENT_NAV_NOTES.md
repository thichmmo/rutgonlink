# Content navigation

The dashboard sidebar (`DashboardNavLinks`) and mobile drawer/bottom bar (`MobileNav`) expose popup and post management while letting each user toggle optional modules (`Links`, `Folders`, `Thống kê`, `Ghi chú`, `FB Debug`) from `/dashboard/settings` (`MenuVisibilitySection` -> `PUT /api/settings/navigation`). `layout.tsx` hydrates `initialVisibility` server-side so hidden items never flash on initial load, and live `dashboard-nav-updated` events synchronize `DashboardNavLinks`, `MobileNav`, and `CreateLinkButton` immediately.

Verify with `npx eslint app/dashboard/DashboardNavLinks.tsx app/dashboard/MobileNav.tsx app/dashboard/CreateLinkButton.tsx app/dashboard/layout.tsx` and `node scripts/test-dashboard-nav-visibility.cjs`.
