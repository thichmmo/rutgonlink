# TikTok affiliate link conversion notes

## Purpose

Expand TikTok short links on the server and derive the legacy `www.tiktok.com/view/product/{id}` URL used by the dashboard tool.

## Behavior

- Only HTTPS TikTok domains are accepted, and every redirect remains restricted to TikTok domains.
- Redirect bodies are discarded and redirect depth/time are bounded.
- The final query string is copied byte-for-byte so signed affiliate parameters are not reordered or re-encoded.
- Product title extraction is display-only and never changes the returned affiliate query.
- The popup affiliate endpoint supplies an optional 8192-character URL budget.
  `resolveTikTokUrl` checks it before the first fetch and before following every
  redirect, so an oversized intermediate URL is reported rather than requested.
  Runtime OneLink preparation and other existing callers omit this option and
  keep their existing resolution behavior. Final converted output is also checked
  by the affiliate endpoint.

## Verification

- Scoped ESLint passes.
- `node scripts/test-popup-affiliate.cjs` checks redirect/output bounds and exact
  query preservation; `node scripts/test-popup-runtime.cjs` covers existing
  short-link app-launch handling with no optional URL budget.
- A live `vt.tiktok.com` conversion resolves product `1730850894108330691` and preserves the raw query exactly.
- Production build passes with the production environment, and release `tiktok-aff-20260830-003` passes preflight and live health checks.
