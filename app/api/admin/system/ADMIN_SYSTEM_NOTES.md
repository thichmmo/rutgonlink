# Admin system API

Health output reports database latency, environment configuration presence, canonical OAuth callbacks, background jobs, payment reconciliation and recent operational warnings without revealing secret values. Log cleanup is owner/ops-only, bounded to 7–365 days and audited.

Verification: viewer can read but cannot cleanup; ops cleanup deletes only records older than cutoff.
