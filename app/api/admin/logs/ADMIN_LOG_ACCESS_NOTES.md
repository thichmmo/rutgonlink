# Request-log admin access

The endpoint is read-only and filters garbage requests in queries instead of deleting data during GET. Explicit retention deletion belongs to the audited System Health action.

Verification: repeated GET calls do not change request-log row count.
