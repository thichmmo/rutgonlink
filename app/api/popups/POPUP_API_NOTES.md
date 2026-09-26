# Popup API

Owner-scoped popup endpoints support search, status filtering, pagination, normalized Shopee/TikTok settings, full-link inspection, duplicate, update and delete. Popup deletion leaves assigned posts intact with a null relation; inactive templates cannot be selected for new posts.

Verify with `pnpm exec eslint app/api/popups` and authenticated create/update/duplicate/delete smoke tests.
