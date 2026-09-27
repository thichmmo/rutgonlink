# Local -> GitHub -> cPanel

The `cpanel-deploy.yml` workflow runs Prisma validation, TypeScript, ESLint and the production cPanel build on every push to `main`. Only a passing `main` build deploys. The runner publishes a temporary release asset, starts a one-shot cPanel cron command through the API, waits for the atomic swap and health checks, then removes the cron entry and release.

The cPanel host discards `Fileman/upload_files` multipart requests from GitHub runners with `You must specify at least one file to upload`, even after bounded parts, short names, and HTTP/1.1. The workflow now publishes the standalone archive as a temporary GitHub release asset. cPanel receives only a Cron API command; the host downloads the release script from the commit's raw GitHub URL and the public archive directly, verifies the SHA-256, then performs the same migration, preflight, atomic swap, and health checks. The temporary release is deleted after production verification succeeds. The rollback trap covers both moves in the live-to-backup and stage-to-live swap window.

The release fetch retries transient GitHub asset failures three times before writing FAILED_PRE_SWAP, which avoids treating a temporary shared-host connection reset as a bad application release.

The lint job scopes the changed content and deployment files. A full-repository ESLint run currently reports legacy errors outside this feature; those are not introduced by this pipeline.

The cPanel runtime keeps pnpm's dependency tree under `.next/standalone/node_modules/.pnpm/node_modules`; the release script exports that directory as `NODE_PATH` during preflight so `@swc/helpers` and other hoisted packages resolve on the host.

The release packager resolves the generated Prisma client beside the real `@prisma/client` package (which lives inside pnpm's virtual store on CI), then copies it into both standalone and Next-traced module paths so the server can load Prisma before the atomic swap.

The packager also dereferences nested pnpm links. The first content release passed the symlink-count check on Windows but its Linux preflight could not load `nanoid/non-secure/index.js` through a nested link; the package now requires that file and a full Linux preflight before production swap.

Post editor uploads are stored under the persistent cPanel app directory `uploads/content`; the release script creates that directory before every atomic swap so published media survives deployments.

If a prior manual deployment already created the popup/post tables, the first CI run adopts that existing schema into `RutgonlinkMigration` instead of replaying the `CREATE TABLE` migration.

Required GitHub Actions secrets:

- `CPANEL_URL`: cPanel origin including port, for example `https://host.example:2083`.
- `CPANEL_USER`: cPanel account username.
- `CPANEL_API_TOKEN`: cPanel API token from the hosting account.

The workflow does not read or commit `host.txt`, `.env`, or any production secret. Existing cPanel databases are baselined from `database.sql`; deploy migrations with names at or after `20260926000000` are tracked in `RutgonlinkMigration` so the first CI deploy does not replay the old baseline migrations.

