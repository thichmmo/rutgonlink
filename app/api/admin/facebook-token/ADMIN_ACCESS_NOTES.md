# Facebook integration admin access

Read operations require system-read permission; token/interval/scrape operations require system-write. Configuration mutations write redacted audit records and never return the saved token.

Verification: owner/ops can write, viewer can only read, support/finance receive 403 for direct access without permission.
