# Popup API

Owner-scoped popup endpoints support search, status filtering, pagination, normalized Shopee/TikTok settings, full-link inspection, duplicate, update and delete. `POST /api/popups` also auto-expands Shopee shortener links (`s.shopee.*`, `shope.ee`, `shp.ee` via `expandShopeeShortUrl` in `lib/shopee-link.ts`) to `shopee.vn/opaanlp/...` on save (falling back to the input URL if offline) so visitors never traverse `s.shopee.vn`'s mobile JS shim. Popup deletion leaves assigned posts intact with a null relation; inactive templates cannot be selected for new posts.

Verify with `node scripts/test-popup-affiliate.cjs` and `npx eslint app/api/popups`.
