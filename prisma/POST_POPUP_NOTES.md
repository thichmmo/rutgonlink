# Managed posts and popups

The migration adds per-user popup templates and posts. A post may reuse one template; deleting a template leaves its posts intact without a popup. Published slugs are globally unique at `/posts/{slug}`.

Verify with `npx prisma validate`, `npx prisma generate`, then apply migrations before deploying app code.
