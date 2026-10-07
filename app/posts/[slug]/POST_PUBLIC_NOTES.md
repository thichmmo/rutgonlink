# Public managed post

Published posts render at `/posts/{slug}`. Their text is escaped by React; a selected popup covers the article with a compact white-card creative until two separate user clicks open Shopee then TikTok. Popups are mobile-only (iPhone/iPad/iPod/Android); desktop visitors see the article immediately. Each step exposes a visible wall-clock timer/progress bar as well as the disabled `Chờ Ns` action, so zero-second and nonzero-second settings are unambiguous. The next step is persisted before navigation; session storage is preferred, with short-lived local-storage/cookie handoff fallback for mobile webviews that reopen the article in a fresh tab. `visibilitychange`/`pagehide`/`pageshow` resume that step when a mobile browser navigates the current tab or returns from the external app. A blocked desktop tab does not advance, and the second step updates in place without a reload. Completion follows the configured cooldown: zero clears the completion marker for the next load, while an unfinished Shopee handoff keeps its short resume window.

Mobile webviews can return a null `window.open` handle even after opening the external tab. Blur/focus lifecycle signals now preserve the committed next step, and the mobile timeout no longer rolls back to Shopee in that case.

On iOS Facebook, product URLs are converted to the same `snssdk1180.onelink.me` handoff used by Boclink, preserving the signed product URL and its tracking parameters. The server page also expands TikTok short links before passing settings to PostPopup; the click still navigates synchronously in the current tab. Failed resolution keeps the original short URL in the current tab rather than a new Facebook webview.

Shopee uses a real hidden `_blank` anchor on iPhone/Facebook. This is intended to
avoid Facebook's empty script-created child page when returning from the Shopee app;
the committed TikTok step remains visible in the original popup page. The native
return path still needs a physical iPhone/Facebook check.

Raw admin source executes script elements after hydration; rich HTML/video embeds are allowlist-sanitized. The Facebook preview image is metadata-only and is not inserted into the public article, so an uploaded preview does not duplicate above the article body. Metadata resolves stored `/uploads/content/...` paths through the server-generated 1200x630 JPEG endpoint and includes complete Open Graph/Twitter image fields so Facebook can render the preview. The primary `/domain/slug` route uses its own server-rendered document and keeps the article hidden until the session completes both clicks.

The DOM is flushed before handing off so iOS does not snapshot the previous popup.
Missing storage never rewinds in-memory progress. Independent, expiring local/cookie
fallbacks include completion and share the cookie key with the root route. A
wall-clock deadline handles countdowns after background suspension, and reading
storage on reload never extends the completion expiry.

Public post pages install the shared inspection guard before the popup's effects.
F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C and desktop right-click redirect once to
`https://mesale.vn`. Entry/lifecycle checks also handle a persistent docked panel
and a phone UA paired with a desktop platform. Real-mobile hints and the destination
host are ignored; cleanup cancels navigation, timers and listeners. Popup startup
and clicks stop when the guard sets `data-post-guard-blocked`.
Server-rendered noscript markup hides the public UI and redirects to Mesale with
JavaScript disabled. This is heuristic deterrence, not source protection; undocked
tools may escape detection and large browser sidebars can resemble a panel.
See `lib/PUBLIC_POST_GUARD_NOTES.md` for the shared behavior and limitations.

All storage sources validate absolute expiry, including session storage. Completion
records carry the configured duration; old permanent/fixed-30m records are ignored.
Zero cooldown clears persisted completion but keeps the current document unlocked
on app return. Test 0, 1, 5 and 60 minutes plus cookie-only reload before/at expiry.

Verify with `node scripts/test-popup-runtime.cjs` and `pnpm exec eslint 'app/posts/[slug]'`, then test both mobile clicks, desktop article rendering, F12/DevTools redirect, tab blocking, refresh, Facebook crawler metadata and a no-popup post on desktop/mobile.

Timer text and a 0-100 percent progress bar share the same deadline. Zero seconds renders ready immediately; focus/visibility return updates both. Verify two nonzero steps plus zero seconds with `node scripts/test-popup-runtime.cjs`.

## Telegram article template

Valid enabled `post.telegramSettings` selects the minimal white template: CTA,
plain-text disclaimer, article media, and privacy footer. Account defaults are
never looked up during rendering; old/null snapshots keep the original article.
Title and Facebook metadata remain even when visual title is hidden. Existing
fixed blocks stay before/after content, and popup runtime stays unchanged.
Verify `node scripts/test-telegram-render.cjs` and `node scripts/test-popup-runtime.cjs`.

## Android app handoff (2026-10-07)

Android Facebook and Chrome use an attached `_self` anchor, synchronously within
one user tap, rather than `window.open` or `location.replace`. `getPopupStep`
keeps the original affiliate `url` separate from its Android `launchUrl`; saved
Android/iOS settings are never changed by public-page rendering. Verified vendor
hosts use an HTTPS Android intent with an encoded original web fallback.

Android holds the clicked popup while waiting for browser confirmation.
A quiet webview after 2.5 seconds enables explicit native retry and “Mở liên kết web”. This is not proof of failure: persisted progress stays
at the next step so a delayed pagehide/app return still resumes correctly. Only
thrown navigation restores persisted progress. No timer launches another URL.
The direct web fallback also stays in the current tab to preserve back history.
The iOS handoff paths, cooldown and accepted-click analytics remain unchanged.

Verify `node scripts/test-popup-runtime.cjs --android-check`, then the full runtime
and affiliate suites. These tests verify URLs, gesture timing, DOM/storage and
return events; real Android app opening requires Facebook/Chrome device testing.

For zero cooldown, a separate one-use session marker restores Android completion
only on `back_forward` navigation after a same-tab fallback without BFCache.
Fresh visits/reloads clear it; expiry remains bounded by the handoff TTL.

## Android consent-dialog correction (2026-10-07)

Android persists the next step before a tap-triggered launch but keeps the clicked
popup visible, including step two. Timeout enables retry in place; it does not
flash the article or another popup and never launches automatically. Native
Facebook confirmation may only blur/focus: those events neither finish the step
nor consume the zero-cooldown history marker. Actual hidden/pagehide followed by
return shows the next step. iOS keeps its existing blur/focus snapshot behavior.
Shopee's launch URL is unchanged (confirmed on the user's device after Continue).
Verify `node scripts/test-popup-runtime.cjs --android-check` and full runtime;
`--android-prompt-baseline` reproduces the prior flash/prompt-focus regression.
