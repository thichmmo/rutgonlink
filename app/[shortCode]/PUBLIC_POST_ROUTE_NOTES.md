# Public managed post route

The root `domain/slug` route checks published managed posts before short links. It filters by primary/shared/verified custom domain, falls back to a primary publication for known shared-domain aliases when an older record has no explicit target, renders fixed content and complete absolute Open Graph/Twitter preview metadata, keeps `/posts/slug` as an alias, and runs the two-step popup in the current session only for mobile UAs. Desktop visitors see the article directly. The inline runtime commits the next step before opening an external URL, keeps a short-lived local-storage/cookie handoff for webviews that reopen a fresh tab, and resumes it through mobile page lifecycle events. Blur/focus signals cover webviews that keep `visibilityState` visible, while mobile null `window.open` results keep the committed step instead of replaying Shopee. If no post matches, the existing short-link flow is unchanged.
On iOS Facebook, a TikTok product URL is wrapped into a Boclink-compatible `snssdk1180.onelink.me` handoff with the original signed URL and tracking payload preserved, then navigated in the current tab. The asynchronous page builder prepares TikTok short links through the shared server helper before serializing popup steps, rather than awaiting a lookup on click. Supplied OneLinks stay intact; failed lookups retain the short link in the current tab. Shopee still uses the attached link action on iPhone/Facebook.

For iPhone/Facebook Shopee navigation, the runtime now clicks a hidden `_blank`
anchor instead of calling `window.open`; this is intended to avoid Facebook's
script-created blank return tab while keeping the next popup committed before
handoff. The native return still requires an iPhone/Facebook check.

Progress bars show the configured seconds for each inline popup step, and the action
stays disabled until its wall-clock deadline. Progress never moves backwards merely because storage reads fail or expire. An
unfinished first handoff carries a 30-minute resume window; completed state uses
the popup's configured cooldown, including zero. Returning refreshes the button
from its deadline, not a restarted countdown. Failed navigation restores the
overlay even after step two.

Session, local storage and the cookie use an absolute expiry. A completion record
also includes its configured duration, so legacy permanent/fixed-30m completion
records are ignored. Loading the article never renews the cooldown. Zero clears
persisted completion while the current document stays unlocked after TikTok returns.

The Facebook preview JPEG stays in Open Graph/Twitter metadata, not the article body.

Every standalone managed-post document also installs the desktop inspection guard,
including posts without an active popup. F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C
and desktop right-click
redirect once to `https://mesale.vn`; mobile UAs and the destination host are
ignored. Zoom/resize alone never redirect. Menu-opened or already-open DevTools
are not detected. Dashboard and ordinary short-link routes remain unchanged.

Verify with `node scripts/test-popup-runtime.cjs` and `pnpm exec eslint 'app/[shortCode]/route.ts'`, plus mobile popup, desktop no-popup/F12, root-post metadata, alias and short-link smoke requests.
