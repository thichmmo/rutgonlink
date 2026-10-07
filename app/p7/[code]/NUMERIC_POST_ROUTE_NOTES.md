# Numeric article route

`/p7/<five-digit code>` maps to the existing unique internal slug `p7-<code>`.
It serves the actual managed-post renderer directly and shares its verified
domain, publication, active-account, popup and tracking guards. Missing/invalid
codes return 404 before short-link lookup or analytics.

Existing `/slug` and `/posts/slug` routes remain valid. Numeric canonicals are
shared by the API and both article renderers through `getPublicPostPath`.

Verification: `node scripts/test-numeric-post-links.cjs`; existing popup runtime
and Telegram render regressions protect the reused renderer.
