# Popup item API

Updates and deletes filter by both ID and session owner to prevent cross-account edits. `PUT /api/popups/[id]` auto-expands Shopee shortener URLs (`s.shopee.*`, `shope.ee`, `shp.ee` via `expandShopeeShortUrl`) to `shopee.vn/opaanlp/...` before persisting (keeping the input URL if offline). Verify with `node scripts/test-popup-affiliate.cjs` and `npx eslint app/api/popups`.
