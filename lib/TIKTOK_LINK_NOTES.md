# TikTok affiliate link conversion notes

## Purpose

Expand TikTok short links on the server and derive the legacy `www.tiktok.com/view/product/{id}` URL used by the dashboard tool.

## Behavior

- Only HTTPS TikTok domains are accepted, and every redirect remains restricted to TikTok domains.
- Redirect bodies are discarded and redirect depth/time are bounded.
- The final query string is copied byte-for-byte so signed affiliate parameters are not reordered or re-encoded.
- Product title extraction is display-only and never changes the returned affiliate query.

## Verification

- Scoped ESLint passes.
- A live `vt.tiktok.com` conversion resolves product `1730850894108330691` and preserves the raw query exactly.
- Production build passes with the production environment, and release `tiktok-aff-20260830-003` passes preflight and live health checks.
