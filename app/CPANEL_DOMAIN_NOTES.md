# Primary domain handling

`proxy.ts` recognizes the primary hostname configured by `NEXTAUTH_URL`; optional full-app aliases come from `APP_ALLOWED_HOSTS`. `app/page.tsx` no longer repeats a client-side domain allow-list, preventing a valid new domain from rendering briefly and then redirecting to `/404`.

Metadata, Open Graph output, API docs and custom-domain DNS validation use the same central `lib/site-config.ts` values. Verification requires a production build plus browser/runtime checks through the public HTTPS domain.

## SEO indexing

`app/sitemap.ts` publishes only canonical public pages and the nine existing blog posts. `app/robots.ts` advertises that sitemap while excluding authenticated/private routes. Home, blog, article and API documentation pages define their own canonical metadata; article pages also publish `BlogPosting` JSON-LD.

Auth, dashboard, admin, password-gate and shared-note layouts explicitly emit `noindex,nofollow` in addition to their robots exclusions.

The blog route compares the content slugs with `app/blog/blog-seo.ts` during build. A stale sitemap entry therefore fails the release instead of publishing a URL that returns 404.

Production must build with `NEXTAUTH_URL=https://rutgonlink.site`. The proxy redirects the primary `www` alias and uses Cloudflare's external-scheme signal for HTTP redirects, avoiding loops caused by the internal reverse proxy reporting `x-forwarded-proto=http`.

Shared publication domains (`ca33newss.xyz`, `6739dd4f.nip.io`, `tin24h-6739dd4f.nip.io`, `103-57-221-79.sslip.io`, `phimngay.site`, `honghotngay228.site`, `phimhaybaz.site`,
and `baonewtin.site`) must be parked/aliased in cPanel to the same
`public_html/rutgonlink.site` Passenger document root. A DNS record alone serves
cPanel's default 404 page before the Next host router can resolve the shared post.
Direct-IP shared domains rely on `.well-known/.htaccess` (`PassengerEnabled off`) for cPanel AutoSSL HTTP-01 DCV renewals and `.htaccess` `R=301,L,NE` (`RewriteCond %{HTTP:CF-Visitor} ^$`) for HTTP-to-HTTPS upgrades.

`app/robots.ts` places the explicit `Allow: /` rule for `facebookexternalhit`, `facebookcatalog`, `Facebot`, `meta-externalagent`, `meta-externalfetcher`, `meta-webindexer`, `Twitterbot`, `LinkedInBot`, and `Zalobot` first and omits the non-standard `Host:` directive so shared/custom domains do not advertise `rutgonlink.site` as their canonical robots host. Verify with `pnpm exec eslint app/robots.ts` and `tsc --noEmit`.

## Google traffic redirect on shortened & shared routes (2026-11-18)

- `proxy.ts` redirects Google traffic (`isGoogleTrafficSource`: Google Search `Referer`, `GSA/` / `GoogleApp` / `Googlebot` UAs, and `gclid`/`gbraid`/`wbraid`/`srsltid`/`utm_source=google`) with `302` (`Cache-Control: private, no-store`) to `https://mesale.vn` on all shared/custom domain public routes (excluding `/robots.txt` and ACME challenges) and on `/p/*`, `/share/*`, `/bio/*` on `rutgonlink.site`, while leaving primary marketing/auth/dashboard routes (`/`, `/pricing`, `/blog`, `/login`, `/dashboard`, `/robots.txt`) untouched. Verify with `node scripts/test-shared-domain-https.cjs`.
