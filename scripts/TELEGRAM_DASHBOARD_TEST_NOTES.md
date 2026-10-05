# Telegram dashboard regression coverage

Run `node scripts/test-telegram-dashboard.cjs` (35 deterministic assertions).
The harness executes actual TSX components in JSDOM with in-memory fetch fixtures;
it creates no production data, uploads no files, and follows no media requests.

Coverage: account-options loading gate; independent defaults and saved post
snapshots; default saving never submits a post; stale options cannot undo newer
default saves; video-only auto-title/slug creation; 200-character and non-Latin
slug inputs; preserving existing content/title; safe media previews; explicit
replacement helper; quick-media and rich-editor upload lifetimes; disabled save,
format selection and embed drawer while uploads are pending. Styled-jsx's marker
is stripped only inside the harness because Next normally compiles that marker.

Also run `node scripts/test-content-media.cjs`, scoped ESLint, and TypeScript.
API authorization/validation and both public renderers have separate Telegram suites.
