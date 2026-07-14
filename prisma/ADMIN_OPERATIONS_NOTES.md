# Admin operations schema

Migration `20260714000000_add_admin_operations` adds user lifecycle/admin-role fields, safe moderation fields, immutable admin audit rows, system events and SePay reconciliation events. Existing users remain `active`; `ADMIN_EMAIL` is still treated as owner by application code.

Verification: run `pnpm exec prisma validate --config prisma.config.ts`, generate Prisma Client, then apply the migration before deploying admin APIs.
