# Admin system health UI

The health page surfaces database latency, cron/webhook heartbeat, configuration presence, job/payment backlog and recent warnings without exposing secret values. Bounded log retention cleanup requires confirmation and audit.

Verification: test configured/missing env states, failed events and owner/ops versus read-only cleanup access.
