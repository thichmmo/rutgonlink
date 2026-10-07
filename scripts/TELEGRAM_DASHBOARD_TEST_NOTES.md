# Telegram dashboard regression coverage

Run `node scripts/test-telegram-dashboard.cjs` (35 deterministic assertions).
The harness executes actual TSX components in JSDOM with in-memory fetch fixtures;
it creates no production data, uploads no files, and follows no media requests.
It installs the JSDOM navigator before React loads, including on Node 20 CI.

Coverage: account-options loading gate; independent defaults and saved post
snapshots; default saving never submits a post; stale options cannot undo newer
default saves; video-only auto-title creation and hidden numeric-create slug; 200-character and non-Latin
slug inputs; preserving existing content/title; safe media previews; explicit
replacement helper; quick-media and rich-editor upload lifetimes; disabled save,
format selection and embed drawer while uploads are pending. Styled-jsx's marker
is stripped only inside the harness because Next normally compiles that marker.

Also run `node scripts/test-content-media.cjs`, scoped ESLint, and TypeScript.
API authorization/validation and both public renderers have separate Telegram suites.

Separate-post-type update: creation uses the explicit `Tạo bài Telegram` entry.
Editing a standard post now checks its selected standard radio and hidden Telegram
fields rather than the removed per-editor enable toggle. Dedicated type switching,
defaults override, filter races and upload locks live in `test-post-types-dashboard.cjs`.

Compact-Telegram update: quick-media tests inspect its safe preview and the saved
payload instead of the intentionally removed article editor. Rich-editor upload
lifetime/format/embed locks still run through standard posts. The dedicated
`test-telegram-quick-form.cjs` covers collapsed settings and actual submit buttons.
