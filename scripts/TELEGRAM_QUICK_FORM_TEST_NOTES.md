# Telegram quick-form regression coverage

Run `node scripts/test-telegram-quick-form.cjs` (96 assertions). The harness
executes actual TSX in JSDOM against in-memory API fixtures; it creates no live
posts, uploads no real files, and loads no remote media.

Coverage: create/edit Telegram forms omit article-editor and format controls;
popup and media controls stay immediately available; optional metadata,
Facebook preview and fixed content remain reachable in collapsed settings;
video or uploaded image plus popup saves without typing an article/title/slug.
Empty media gets actionable feedback. Native save-button clicks exercise the
Telegram/manual versus standard/native validation paths, including a hidden
invalid Telegram URL and corrected retry. Metadata/API failures reveal settings
and retain drafts; title/slug regeneration works after users clear those fields.

Mode changes may unmount the rich editor, but must retain the draft body and
metadata in parent state. Tests round-trip mixed text/media, preserve legacy
plain/raw content byte-for-byte, retain media across fixed-content management,
and check upload-mode locks. A required plain-text field is absent after switching
to Telegram, so it cannot block media-only publishing. Standard create/edit retain
their full editor and native required validation.

Baseline/rollback: extract commit `435657b` to a separate directory, set
`TELEGRAM_QUICK_FORM_TEST_ROOT` to it, then run
`node scripts/test-telegram-quick-form.cjs --baseline`. This verifies the original
Telegram editor/format plus expanded metadata (4 assertions). The fixture does
not change the chosen source tree. Also run the Telegram dashboard, post-types
dashboard, fixed-content composer, API and public-renderer regressions.
