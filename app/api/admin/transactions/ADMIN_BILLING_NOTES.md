# Admin billing API

Payments, subscriptions and webhook events share paginated search/status filters. Finance/owner can manually complete or cancel pending payments; activation reuses the same cumulative expiry transaction as SePay. Every mutation requires a reason and audit row.

Verification: complete a pending payment once, retry idempotently, cancel a separate pending payment and confirm user/subscription state.
