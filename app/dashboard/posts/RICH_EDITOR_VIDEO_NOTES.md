# Rich editor video removal

The editor lists each iframe/video separately with Select and Delete controls outside `contentEditable`, so embedded players cannot swallow the removal action. Selecting highlights that media and places the caret after it; Delete/Backspace then removes only the selected video. Controls obey disabled/uploading state. Empty dedicated figure/embed wrappers are removed together; wrappers retain other media and text, including captions, and empty legacy sizing wrappers are cleaned up.

Saved HTML strips the temporary selection attribute. Controls never enter the content HTML, and the public `videoEmbedHtml` output/style and upload handling are unchanged. Repeated video insertions remain independent. Source mode continues to edit the original HTML directly.

Telegram quick mode uses its own editor and does not mount RichEditor. This change covers standard Rich text and Telegram content temporarily switched to the standard editor; quick-mode deletion is described in `TELEGRAM_MEDIA_REMOVAL_NOTES.md`.

Verified: `node scripts/test-rich-editor-video.cjs` (9 scenarios), scoped ESLint, `node scripts/test-post-types-dashboard.cjs` (78), `node scripts/test-telegram-dashboard.cjs` (35), `node scripts/test-content-media.cjs` (6), and `tsc --noEmit --incremental false` for the RichEditor change. Final combined TypeScript/build and desktop-browser selection/iframe integration are checked by the coordinating task; no phone UI is involved.
