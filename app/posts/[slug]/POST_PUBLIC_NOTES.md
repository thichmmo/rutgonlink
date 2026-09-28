# Public managed post

Published posts render at `/posts/{slug}`. Their text is escaped by React; a selected popup covers the article with a compact white-card creative until two separate user clicks open Shopee then TikTok. The next step is persisted before navigation; session storage is preferred, with short-lived local-storage/cookie handoff fallback for mobile webviews that reopen the article in a fresh tab. `visibilitychange`/`pagehide`/`pageshow` resume that step when a mobile browser navigates the current tab or returns from the external app. A blocked desktop tab does not advance, and the second step updates in place without a reload. Progress persists in the current browser session and resets when the popup template changes.

Mobile webviews can return a null `window.open` handle even after opening the external tab. Blur/focus lifecycle signals now preserve the committed next step, and the mobile timeout no longer rolls back to Shopee in that case.

On iOS Facebook, product URLs are converted to the same `snssdk1180.onelink.me` handoff used by Boclink, preserving the signed product URL and its tracking parameters. The server page also expands TikTok short links before passing settings to PostPopup; the click still navigates synchronously in the current tab. Failed resolution keeps the original short URL in the current tab rather than a new Facebook webview.

Shopee uses a real hidden `_blank` anchor on iPhone/Facebook. This is intended to
avoid Facebook's empty script-created child page when returning from the Shopee app;
the committed TikTok step remains visible in the original popup page. The native
return path still needs a physical iPhone/Facebook check.

Raw admin source executes script elements after hydration; rich HTML/video embeds are allowlist-sanitized. A post with `isFakeVideo` overlays a play button on its preview image. The primary `/domain/slug` route uses its own server-rendered document and keeps the article hidden until the session completes both clicks.

The DOM is flushed before handing off so iOS does not snapshot the previous popup.
Missing storage never rewinds in-memory progress. Independent, expiring local/cookie
fallbacks include completion and share the cookie key with the root route. A
wall-clock deadline handles countdowns after background suspension.

Verify with `node scripts/test-popup-runtime.cjs` and `pnpm exec eslint 'app/posts/[slug]'`, then test both clicks, tab blocking, refresh and a no-popup post on desktop/mobile.
