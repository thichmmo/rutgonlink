# Content management helpers

Shared validation normalizes popup settings, enforces active-popup ownership for new posts, validates primary/shared/verified custom publication targets, sanitizes rich HTML, and gates raw HTML/Script to admin actors.

Verify with `pnpm exec eslint lib/content-management.ts lib/popup-settings.ts` and `pnpm exec tsc --noEmit --pretty false`.
