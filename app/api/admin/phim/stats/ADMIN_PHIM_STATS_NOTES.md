# Web phim statistics access

Statistics now use centralized system-read authorization so read-only operational roles can inspect data without receiving mutation permissions.

Verification: owner/ops/viewer read according to role permissions; non-admin receives 403.
