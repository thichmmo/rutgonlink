# SePay reconciliation events

Every inbound transfer now creates or updates a `PaymentEvent` without storing the bank account number. Matched, duplicate, amount-mismatch, ignored, unmatched and error outcomes remain available to admin for reconciliation. Payment activation uses shared cumulative-expiry logic.

Requests must provide `SEPAY_WEBHOOK_SECRET` through `Authorization: Bearer ...` or `x-sepay-secret`; missing server configuration fails closed.

Verification: replay the same transaction ID, send unmatched content and insufficient amount, then inspect payment events and ensure only one payment activation occurs.
