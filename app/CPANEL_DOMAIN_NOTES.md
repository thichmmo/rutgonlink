# Primary domain handling

`proxy.ts` recognizes the primary hostname configured by `NEXTAUTH_URL`; optional full-app aliases come from `APP_ALLOWED_HOSTS`. `app/page.tsx` no longer repeats a client-side domain allow-list, preventing a valid new domain from rendering briefly and then redirecting to `/404`.

Metadata, Open Graph output, API docs and custom-domain DNS validation use the same central `lib/site-config.ts` values. Verification requires a production build plus browser/runtime checks through the public HTTPS domain.

## SEO indexing

`app/sitemap.ts` publishes only canonical public pages and the nine existing blog posts. `app/robots.ts` advertises that sitemap while excluding authenticated/private routes. Home, blog, article and API documentation pages define their own canonical metadata; article pages also publish `BlogPosting` JSON-LD.

Auth, dashboard, admin, password-gate and shared-note layouts explicitly emit `noindex,nofollow` in addition to their robots exclusions.

The blog route compares the content slugs with `app/blog/blog-seo.ts` during build. A stale sitemap entry therefore fails the release instead of publishing a URL that returns 404.

Production must build with `NEXTAUTH_URL=https://rutgonlink.site`. The proxy redirects the primary `www` alias and uses Cloudflare's external-scheme signal for HTTP redirects, avoiding loops caused by the internal reverse proxy reporting `x-forwarded-proto=http`.
