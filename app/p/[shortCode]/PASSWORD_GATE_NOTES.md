# Password-protected short link gate

- [page.tsx](page.tsx) renders the password entry UI for password-protected shortened links (`/p/<shortCode>`).
- In addition to the server-side `302` `shouldRedirectToMesale` redirect in `proxy.ts`, a client-side `useEffect` checks `navigator.userAgent`, `document.referrer`, and `window.location.search` and replaces location with `https://mesale.vn` whenever the visit is from Google or lacks a Facebook origin (`FBAN`/`FB_IAB` UA, Facebook Referer, `fbclid`, or `_fbh`).
- Verify: `node scripts/test-shared-domain-https.cjs` and `npx tsc --noEmit --pretty false`.
