# Affiliate resolution

The authenticated endpoint accepts credential-free HTTP(S) URLs up to the shared
8192-character popup limit. It supports Shopee (`shopee.*`, `s.shopee.*`, `shope.ee`, `shp.ee`) and TikTok (`tiktok.com`, `vt.tiktok.com`, `vm.tiktok.com`, `tiktokv.com`, `onelink.me`) links with manual redirects and timeouts.
- **TikTok**: Returns the signed `view/product` URL alongside both `title` and `image` extracted from `og_info` (including nested OneLink/`tiktokv.com` payloads).
- **Shopee**: Shares shortener/market host rules (`SHOPEE_MARKET_DOMAINS`, `SHOPEE_SHORT_HOSTS`, `DESKTOP_SHORTENER_REDIRECT_UA`, `isShopeeShortenerHost`) from `lib/shopee-link.ts` to expand shortener hops (`s.shopee.*`, `shope.ee`, `shp.ee`) via immediate `301` redirect (`referrerPolicy: 'no-referrer'`) to the `opaanlp` affiliate URL without ever fetching signed `/opaanlp/` or `/universal-link/` targets on the server, strips generic Shopee homepage fallback titles/logos, and fetches SSR Open Graph metadata (`og:title` stripped of trailing ` | Shopee...`, plus `og:image`) directly from unsigned `/product/<shopId>/<itemId>` using `WhatsApp/2.24.12.78 A` with `referrerPolicy: 'no-referrer'`.

Resolved results and all redirect targets must satisfy the same URL boundary.
TikTok receives an optional URL budget checked before each upstream fetch; public
popup runtime callers do not opt in and retain their existing OneLink behavior.
An overlong/invalid result returns the original source with a Vietnamese `warning`,
never a truncated URL. The editor uses that warning to retain the existing iOS
destination. TikTok lookup failures also return the original immediately rather
than falling through to a second, generic fetch. The original query remains intact.

Verification: `node scripts/test-popup-affiliate.cjs` covers long source/result
boundaries, query preservation, network failure and redirect guards; scoped ESLint
includes this route, `lib/popup-affiliate-url.ts` and `lib/content-management.ts`.
