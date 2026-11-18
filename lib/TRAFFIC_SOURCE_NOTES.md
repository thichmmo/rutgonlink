# Traffic source detection & Facebook->Chrome handoff

## Purpose

Centralizes Facebook popup eligibility (`onlyFromFacebook`) and Google redirect (`GOOGLE_REDIRECT_URL = 'https://mesale.vn'`) across server routes, edge proxy, and client fallbacks:

- [traffic-source.ts](traffic-source.ts): Isomorphic helpers (`isFacebookUserAgent`, `isFacebookReferer`, `hasFacebookClickId`, `extractFacebookHandoffToken`, `isGoogleUserAgent`, `isGoogleReferer`, `hasGoogleClickParams`, `isGoogleTrafficSource`) with zero `node:*` imports so both edge/server routes and `'use client'` components can share them. `readParam` duck-types `.searchParams` (`typeof source.searchParams.get === 'function'`) rather than relying on `instanceof URL` because Next.js `NextURL` (`req.nextUrl`) composes `URL` without inheriting from `globalThis.URL`.
- [facebook-handoff-token.ts](facebook-handoff-token.ts): Server HMAC-SHA256 token signer/verifier (`createFacebookHandoffToken`, `verifyFacebookHandoffToken`, `isServerFacebookTrafficSource`, `shouldRedirectToMesale`) bound to the normalized request hostname with a 24-hour TTL (`FACEBOOK_HANDOFF_TTL_MS`).

## Behavior

1. **Non-Facebook redirect to `https://mesale.vn` (`shouldRedirectToMesale`)**:
   - All public short-link and post routes (`/<shortCode>`, `/p7/<code>`, `/posts/<slug>`, `/p/<shortCode>`, `/share/*`, `/bio/*`) redirect `302` (`Cache-Control: private, no-store`) to `https://mesale.vn` whenever `shouldRedirectToMesale` is `true` — covering PC desktop browsers (Chrome, Edge, Cốc Cốc, Safari, Firefox), non-Facebook mobile browsers/apps (Safari, Chrome direct, Zalo, Telegram, TikTok, Instagram), and all Google Search / `GSA` / `Googlebot` / `gclid` traffic.
   - Only two classes of requests pass through without redirecting to `mesale.vn`:
     - **Facebook/Meta link-preview crawlers** (`FACEBOOK_CRAWLER_UA_PATTERN`: `facebookexternalhit`, `facebookcatalog`, `Facebot`, `meta-externalagent`, `meta-externalfetcher`, `meta-webindexer`) so posted/commented links always keep their Open Graph title and thumbnail preview.
     - **Confirmed Facebook/Messenger visits** (`isServerFacebookTrafficSource`: `FBAN`/`FBAV`/`FBIOS`/`FB_IAB`/`FB4A`/`FBLite`/`Orca-Android`/`Messenger` UA, `*.facebook.com`/`fb.com`/`*.messenger.com`/`m.me` Referer, `fbclid`, or a host-verified HMAC `_fbh` token from the Android Chrome/system-browser gate) when not originating from Google.
2. **Facebook-only popup visibility (`onlyFromFacebook`, default `true`)**:
   - `defaultPopupSettings` and `normalizePopupSettings` default `onlyFromFacebook` to `true` unless `input.onlyFromFacebook === false`, so existing database popups and newly created popups enforce Facebook-only popup display automatically while remaining toggleable in `/dashboard/popups`.
   - A visit counts as originating from Facebook when any of the following matches:
     - Facebook/Messenger in-app User-Agent (`FBAN`, `FBAV`, `FBIOS`, `FB_IAB`, `FB4A`, `FBAndroid`, `FBLite`, `Orca-Android`, `Messenger`),
     - `Referer` matching `*.facebook.com`, `fb.com`, `*.messenger.com`, `m.me`, or `android-app://com.facebook.{katana,lite,orca,mlite,pages.app}`,
     - `fbclid` query parameter,
     - `_fbh` query parameter verified against the current host by `verifyFacebookHandoffToken` (minted when rendering the Android Chrome/system-browser gate inside Facebook IAB so standalone Chrome continues the popup sequence even when `Referer` and `fbclid` are absent).
3. **Google redirect to `https://mesale.vn`**:
   - Matches Google `Referer` (`*.google.<tld>`, `g.co`, `android-app://com.google.android.{googlequicksearchbox,gm,apps.searchlite}`), Google App / Google crawler User-Agents (`GSA/`, `GoogleApp`, `Googlebot`, `AdsBot-Google`, `Google-InspectionTool`, `Google-Safety`, etc.), or Google click parameters (`gclid`, `gbraid`, `wbraid`, `srsltid`, `utm_source=google`).
   - Never matches ordinary Chrome (`Chrome/`) or iOS Chrome (`CriOS/`) User-Agents without a Google referrer/click signal, preserving Android's Facebook -> Chrome handoff.

## Verification

- `node scripts/test-popup-runtime.cjs --android-native-check` (52 scenarios)
- `node scripts/test-popup-runtime.cjs` (145 scenarios)
- `node scripts/test-shared-domain-https.cjs` (18 scenarios)
