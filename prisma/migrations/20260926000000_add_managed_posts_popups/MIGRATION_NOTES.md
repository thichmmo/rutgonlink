# Migration

Creates owner-scoped popup templates and published/draft posts. The foreign key uses `User.internalId` and popup deletion sets the post's `popupId` to null.

Verify schema with `npx prisma validate`; apply this migration to the target database before deploying the new app routes.
