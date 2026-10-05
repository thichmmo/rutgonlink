# Telegram public-render regression tests

`node scripts/test-telegram-render.cjs` transpiles the actual shared renderer and both public post paths without a database or network calls. Fixtures keep affiliate popups disabled. Coverage includes saved-post snapshots independent of account defaults, legacy/disabled layouts, CTA/disclaimer/media ordering, preserved account content blocks, uploaded media, metadata, allowed Telegram destinations, and HTML escaping.

Run baseline behavior against a source snapshot with `POPUP_TEST_ROOT` and `--baseline`; it confirms the old code ignores Telegram settings while retaining the original article. `--export-fixture <directory>` additionally emits a static browser-QA document with guards/scripts removed and an embedded video placeholder, so it never contacts a video provider or affiliate destination.

No migration, production write, navigation script, cookie, or click event runs in this suite. The existing popup runtime suite remains responsible for popup behavior.

Verified on 2026-10-05: `node scripts/test-telegram-render.cjs` passed 36 scenarios; `--baseline` against the pre-feature archive passed 2 scenarios; `pnpm exec eslint scripts/test-telegram-render.cjs` exited 0. The enabled and disabled pages emit identical script tags, and unsafe saved destinations emit no Telegram CTA while keeping the media visible.
