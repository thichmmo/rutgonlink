# Affiliate resolver API

`/api/content/resolve-affiliate` performs best-effort same-network redirect and metadata resolution for supported Shopee/TikTok URLs. Failed resolution returns the original URL with a warning, and authentication is required.

Verify with `pnpm exec eslint app/api/content` and a supported URL plus a fallback URL.
