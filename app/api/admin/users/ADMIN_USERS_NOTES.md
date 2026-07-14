# Admin user API

User listing supports plan/status/login filters, sequential numeric-ID search and aggregate activity. User detail exposes operational history without returning password, API key or OAuth secrets. Mutations are validated, reason-required, soft-delete based and audited; owner/self destructive actions are blocked. Internal CUIDs remain route keys only.

Verification: exercise each PATCH action with owner/support roles, confirm audit rows, and confirm suspended/revoked sessions lose `/api/auth/session` user data.
