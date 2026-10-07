# Telegram quick media removal

The quick editor lists every iframe/video/image in existing or newly appended content with a separate Delete button. Its layout preview now shows all validated media in insertion order. Invalid legacy media still get removal controls without rendering unsafe URLs.

Deletion calls `onContentChange(nextHtml)`, never `onInsert`, so PostManager retains title, slug/link, content format and settings. The helper removes the selected original HTML span; signed source queries and unrelated text/media are not reserialized. Dedicated empty wrappers are removed, while mixed wrappers and captions stay intact. Empty insertion spacers become an empty body after the last media is deleted, allowing the existing save validation to request content. Raw script/comment/textarea contents are excluded from the media inventory. Controls remain outside saved HTML and are locked during uploads or disabled forms; append and confirmed replacement keep their prior behavior.

Verified: `node scripts/test-telegram-media-removal.cjs` (8 scenarios) and scoped ESLint. Combined dashboard regressions, TypeScript/build and actual desktop-browser behavior are checked by the coordinating task.
