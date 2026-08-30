# TikTok link API notes

## Purpose

Expose an authenticated dashboard endpoint that converts a TikTok short product link into its official expanded URL and `www.tiktok.com/view/product` form.

## Behavior

- `POST /api/tiktok-link` accepts `{ "url": "https://vt.tiktok.com/..." }`.
- Requests require an active dashboard session and are limited to 20 conversions per minute per user.
- Expected validation and upstream errors return actionable Vietnamese messages.

## Verification

- Scoped ESLint passes.
- A live `vt.tiktok.com` sample resolves to the expected product ID and preserves its raw query.
- Production build passes with the production environment; the deployed endpoint returns `401` for unauthenticated requests as expected.
