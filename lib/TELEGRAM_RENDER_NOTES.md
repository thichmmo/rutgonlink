# Telegram public template

`telegram-render.ts` shares escaped CTA/disclaimer markup and scoped CSS across
the React alias and standalone share-domain renderer. Only a valid enabled post
snapshot activates the minimal layout; legacy posts never inherit account defaults.
CTA opens HTTPS Telegram in a new tab without touching popup progress or analytics.
Before/after fixed blocks remain intact. Privacy uses the main origin because share
domains may proxy only post routes. Verify `node scripts/test-telegram-render.cjs`
and `node scripts/test-popup-runtime.cjs` for layout and existing popup behavior.


## Extra CTA Button Rendering (2026-11-21)

- `renderTelegramHeader` renders each item in `settings.extraButtons` inside `<div class="telegram-cta-extra">` with `.telegram-cta` and optional `.telegram-cta--{orange,emerald,dark}` modifier classes, escaping both `href` and label text. Single-button markup remains unchanged when `extraButtons` is absent.
- Verify: `node scripts/test-telegram-render.cjs` (51 scenarios).
