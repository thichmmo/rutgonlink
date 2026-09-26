# Managed post fake-video flag

Adds the persisted `ManagedPost.isFakeVideo` toggle used by the Boclink-style post editor. Existing posts default to disabled and keep their current preview image/content.

Verify with `pnpm exec prisma validate` and `pnpm exec prisma generate` before applying the migration in production.
