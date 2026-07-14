# Primary domain handling

`app/page.tsx` and `proxy.ts` recognize the primary hostname configured by `NEXTAUTH_URL`. `rutgonlink.site` is the current primary domain; `clonetot.site` remains an allowed alias so a domain switch does not trigger `/404` during client hydration.

Metadata, sign-out redirect and custom-domain DNS validation also use the current deployment domain. Verification requires a production build plus browser/runtime checks through the public HTTPS domain.
