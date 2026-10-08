# Rich editor upload regression

Run `node scripts/test-rich-editor-upload.cjs`. It loads the actual RichEditor TSX in JSDOM and deliberately refuses `execCommand('insertHTML')` when `contentEditable=false`, matching the browser failure during upload. This catches the previous empty-body/false-success bug rather than assuming every command inserts HTML.

The cases exercise real DOM ranges and file/paste event handlers for locked image/video upload insertion, empty/mixed bodies, saved caret and selected text, successive uploads, normal native direct insertion, source mode, failed/missing-range insertion, duplicate actions, close/stale responses and the existing FileReader image fallback. Upload results remain deterministic fixtures; no remote API or production record is touched. Native file selection and playback are checked separately in the actual browser. Clipboard coverage here is synthetic.
