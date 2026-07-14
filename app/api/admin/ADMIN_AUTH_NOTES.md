# Centralized admin authorization

All admin APIs use `requireAdmin(permission)` instead of comparing `ADMIN_EMAIL` independently. Existing integrations map to system read/write permissions, traffic/logs map to logs read, and every phim configuration mutation writes an audit row.

Read-only logs no longer deletes garbage records; retention cleanup is an explicit audited system action. Non-owner roles cannot mutate another admin account.

Verification: exercise owner, support, finance, ops and viewer against representative routes and confirm 403 for missing permissions.
