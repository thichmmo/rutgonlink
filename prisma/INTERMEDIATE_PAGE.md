# Video-style intermediate page fields

`Link.enableIntermediatePage` defaults to `false`; `Link.intermediateImage` stores an optional image URL or data URL. Apply `migrations/20260925000000_add_intermediate_page/migration.sql` to existing databases.

Verification: `npx prisma validate`.
