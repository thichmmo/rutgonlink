# Admin session lifecycle

NextAuth session/JWT types include user status, role and invalidation state. `auth-options.ts` checks the database on authenticated session reads; suspended, deleted or explicitly revoked users receive no session user. Dashboard layout rejects non-active sessions.

Verification: typecheck, login with an active account, then set `sessionsRevokedAt` or `status=suspended` and confirm `/api/auth/session` no longer returns a user.
