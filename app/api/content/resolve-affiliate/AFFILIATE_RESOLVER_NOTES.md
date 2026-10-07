# Affiliate resolution

The authenticated endpoint accepts credential-free HTTP(S) URLs up to the shared
8192-character popup limit. It retains the existing Shopee/TikTok fetch allowlist,
manual redirects and timeouts. TikTok conversion still returns the signed
`view/product` URL; this endpoint does not alter Android/iOS popup settings.

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
