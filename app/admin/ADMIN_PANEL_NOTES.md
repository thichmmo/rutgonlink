# Admin operations panel

The layout uses centralized RBAC and hides navigation items the current role cannot read. Operational modules cover overview, users, links, domains, billing, traffic, audit, system health and existing integrations; `ADMIN_EMAIL` remains owner fallback. Google OAuth includes an owner-only encrypted credential form while read-only roles see status and callback URLs only.

Verification: render the layout for owner/support/finance/ops/viewer and confirm navigation plus direct API authorization match.
