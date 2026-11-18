# Password-protected short link gate

- [page.tsx](page.tsx) renders the password entry UI for password-protected shortened links (`/p/<shortCode>`).
- In addition to the server-side `302` redirect in `proxy.ts`, a client-side `useEffect` checks `isGoogleTrafficSource` (`navigator.userAgent`, `document.referrer`, `window.location.search`) and replaces location with `https://mesale.vn` if opened from Google.
- Verify: `node scripts/test-shared-domain-https.cjs` and `npx tsc --noEmit --pretty false`.
