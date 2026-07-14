# Domain moderation mutation

All mutations require a reason and audit entry. Re-enable intentionally does not set `verified=true` because DNS ownership may have changed while disabled.

Verification: support can mutate, viewer receives 403, and audit before/after data excludes secrets.
