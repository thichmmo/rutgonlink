# System-Wide Post Fallback Config (`lib/post-fallback-config.ts`)

## Purpose
Stores and resolves the admin-configured global fallback destination (`AppSetting.key = "system_post_fallback"`) for deleted or missing article links (`/p7/<code>` and `/posts/<slug>`) across the entire system, without exposing any fallback UI or API to regular dashboard users.

## Behavior
- `normalizeFallbackTargetUrl` accepts full `http://` / `https://` URLs as well as shorthand `/p7/<code>`, `p7/<code>`, and `/posts/<slug>` paths (expanded against `SHARED_DOMAINS[0] || getSiteHostname()`), rejecting non-HTTP(S) schemes.
- `resolveSystemPostFallback` classifies `targetUrl` only when an article slug lookup misses:
  - Internal `/p7/<code>`, `/p7-<code>`, and `/posts/<slug>` URLs on managed hosts (`isMainAppHostname`, `SHARED_DOMAINS`, or verified active `Domain`) resolve the published `ManagedPost` directly (`kind: 'post'`) so the visitor sees the Admin's post + active Popup immediately; if that target post was deleted or unpublished, it returns `null` (`404`) rather than redirecting to itself in a loop.
  - Single-segment paths on managed hosts render the matching published `ManagedPost` if one exists, otherwise fall back to `kind: 'redirect'` (supporting internal short links such as `/r4noIg`).
  - External URLs resolve to `kind: 'redirect'` (`302`).

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `npx tsc --noEmit --pretty false`
