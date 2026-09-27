# Public managed post

Published posts render at `/posts/{slug}`. Their text is escaped by React; a selected popup covers the article with a compact white-card creative until two separate user clicks open Shopee then TikTok in new tabs. The next step is persisted before `window.open`; session storage is preferred, with short-lived local-storage/cookie handoff fallback for mobile webviews that reopen the article in a fresh tab. `visibilitychange`/`pagehide`/`pageshow` resume that step when a mobile browser navigates the current tab or returns from the external app. A blocked tab does not advance, and the second step updates in place without a reload (important for Facebook/in-app browsers). Progress persists in the current browser session and resets when the popup template changes.

Raw admin source executes script elements after hydration; rich HTML/video embeds are allowlist-sanitized. A post with `isFakeVideo` overlays a play button on its preview image. The primary `/domain/slug` route uses its own server-rendered document and keeps the article hidden until the session completes both clicks.

Verify with `pnpm exec eslint 'app/posts/[slug]'`, then test both clicks, tab blocking, refresh and a no-popup post on desktop/mobile.
