# FB Debug retry notes

## Purpose
Keep Facebook debug jobs from treating `errorCode=100` / `Invalid parameter` as a completed scrape.

## Behavior
- `triggerFbScrape` retries transient Facebook scrape errors, including code `100`, before returning failure.
- Batch jobs leave code `100` items pending for bounded retries instead of marking them successful.
- `lastFbDebug` is updated only after Facebook accepts the scrape, so failed links remain eligible for another run.
- Batch and cron scrapes assign a primary token by link/job index, then fall back to the remaining tokens only if the primary token fails.
- Manual scrape uses an in-process per-user round-robin start index so repeated tests also spread across live tokens.
- Job items record the primary/final token index in `message` so future debugging can confirm token distribution without exposing token values.

## Verification
- `npx.cmd eslint lib/fb-debug-actions.ts lib/fb-debug-cron.ts` passes with 0 errors and 0 warnings.
- Temporary scoped `npx.cmd tsc --noEmit --pretty false --incremental false --project tsconfig.fb-debug-check.json` over the changed FB debug files passes.
- A Node source-extraction assertion verifies `5 links / 2 tokens => 1,2,1,2,1`, `5 links / 3 tokens => 1,2,3,1,2`, fallback order, and manual repeated scrape rotation.
- Full repo `npx.cmd tsc --noEmit --pretty false --incremental false --project tsconfig.json` is currently blocked by untracked `codex/skills/*` TypeScript files outside the app target.
