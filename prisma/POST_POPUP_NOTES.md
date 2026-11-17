# Managed posts and popups

The migration adds per-user popup templates and posts. A post may reuse one template; deleting a template leaves its posts intact without a popup. Published slugs are globally unique at `/posts/{slug}`.

Verify with `npx prisma validate`, `npx prisma generate`, then apply migrations before deploying app code.

## Direct Wrapper & Numeric `/p7` Anti-404 Fallback Columns (2026-11-18)

- Migration `20261118000000_add_direct_wrapper_and_numeric_fallback` adds `User.numericFallbackEnabled BOOLEAN NOT NULL DEFAULT false` and `ManagedPost.isDirectWrapper BOOLEAN NOT NULL DEFAULT false`.
- Verify: `npx prisma validate && npx prisma generate`.
