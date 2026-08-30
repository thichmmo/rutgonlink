# TikTok affiliate tool UI notes

## Purpose

Add a focused dashboard tool for expanding TikTok short product links and copying their `www.tiktok.com/view/product` form.

## Behavior

- The form accepts a TikTok URL and calls the authenticated conversion API.
- The result emphasizes the converted URL, product ID, title, copy action, and test-open action.
- The official TikTok Shop URL remains available as a secondary expandable result.
- The layout works on desktop and mobile dashboard widths.

## Verification

- Scoped ESLint passes.
- Production build passes with the production environment, and the deployed dashboard route redirects unauthenticated users to login as expected.
