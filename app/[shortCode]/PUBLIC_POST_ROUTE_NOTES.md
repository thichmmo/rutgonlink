# Public managed post route

The root `domain/slug` route checks published managed posts before short links. It filters by primary/shared/verified custom domain, renders fixed content and preview metadata, keeps `/posts/slug` as an alias, and runs the two-step popup in the current session. The inline runtime commits the next step before opening an external URL, keeps a short-lived local-storage/cookie handoff for webviews that reopen a fresh tab, and resumes it through mobile page lifecycle events. Blur/focus signals cover webviews that keep `visibilityState` visible, while mobile null `window.open` results keep the committed step instead of replaying Shopee. If no post matches, the existing short-link flow is unchanged.
On iOS Facebook, a TikTok product URL is wrapped into a Boclink-compatible `snssdk1180.onelink.me` handoff with the original signed URL and tracking payload preserved, then navigated in the current tab so TikTok can claim the universal link; an already supplied OneLink is kept unchanged. Shopee still opens in a new tab, but iPhone/Facebook uses an attached link action.

For iPhone/Facebook Shopee navigation, the runtime now clicks a hidden `_blank`
anchor instead of calling `window.open`; this is intended to avoid Facebook's
script-created blank return tab while keeping the next popup committed before
handoff. The native return still requires an iPhone/Facebook check.

Progress never moves backwards merely because storage reads fail or expire. Local
storage and cookies are independent, carry a 30-minute expiry and persist completion
as well as the first handoff. Returning refreshes the button from its deadline, not
a restarted countdown. Failed navigation restores the overlay even after step two.

Verify with `node scripts/test-popup-runtime.cjs` and `pnpm exec eslint 'app/[shortCode]/route.ts'`, plus root-post, alias and short-link smoke requests.
