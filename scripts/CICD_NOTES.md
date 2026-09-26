# Local -> GitHub -> cPanel

The `cpanel-deploy.yml` workflow runs Prisma validation, TypeScript, ESLint and the production cPanel build on every push to `main`. Only a passing `main` build deploys. The runner uploads a standalone archive through the cPanel API, starts a one-shot cPanel cron command, waits for the atomic swap and health checks, then removes the cron entry.

The lint job scopes the changed content and deployment files. A full-repository ESLint run currently reports legacy errors outside this feature; those are not introduced by this pipeline.

Required GitHub Actions secrets:

- `CPANEL_URL`: cPanel origin including port, for example `https://host.example:2083`.
- `CPANEL_USER`: cPanel account username.
- `CPANEL_API_TOKEN`: cPanel API token from the hosting account.

The workflow does not read or commit `host.txt`, `.env`, or any production secret. Existing cPanel databases are baselined from `database.sql`; deploy migrations with names at or after `20260926000000` are tracked in `RutgonlinkMigration` so the first CI deploy does not replay the old baseline migrations.
