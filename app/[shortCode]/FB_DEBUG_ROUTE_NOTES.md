# Short-code FB debug notes

## Purpose
Avoid hiding failed Facebook scrape attempts behind the route cooldown.

## Behavior
- Social-bot slot scrape now records `lastFbDebug` only when Facebook returns OK.
- `ogAutoReset` debug also records the cooldown only after Facebook accepts the scrape.
- Failed attempts keep the link eligible for another debug pass.

## Verification
- Scoped ESLint over the changed FB debug files passes with 0 errors.
- Temporary scoped `tsc --noEmit` over the changed files passes.
- Full `npm.cmd run build` is blocked by the unrelated untracked `codex/skills/gstack/scripts/dev-skill.ts` TypeScript error.
