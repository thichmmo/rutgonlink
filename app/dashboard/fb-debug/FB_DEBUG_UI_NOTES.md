# FB debug UI notes

## Purpose
Make the "Debug ngay" feedback match the background job behavior.

## Behavior
- The button no longer reports `0/0` when the API has only queued a job.
- Empty runs show that no link is eligible.
- Queued runs show the total number of links waiting for the background batch.

## Verification
- Scoped ESLint over the changed FB debug files passes with 0 errors.
- Temporary scoped `tsc --noEmit` over the changed files passes.
- Full `npm.cmd run build` is blocked by the unrelated untracked `codex/skills/gstack/scripts/dev-skill.ts` TypeScript error.
