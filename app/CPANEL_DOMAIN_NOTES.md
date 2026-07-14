# Primary domain handling

`proxy.ts` recognizes the primary hostname configured by `NEXTAUTH_URL`; optional full-app aliases come from `APP_ALLOWED_HOSTS`. `app/page.tsx` no longer repeats a client-side domain allow-list, preventing a valid new domain from rendering briefly and then redirecting to `/404`.

Metadata, Open Graph output, API docs and custom-domain DNS validation use the same central `lib/site-config.ts` values. Verification requires a production build plus browser/runtime checks through the public HTTPS domain.
