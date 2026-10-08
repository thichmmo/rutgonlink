# Telegram article video UI checks

Run `node scripts/test-article-video-ui.cjs`. The test loads the actual TelegramPostEditor and PostManager TSX in JSDOM and intercepts all network requests. It covers unchanged direct media inputs, article resolution busy/no-autosave behavior, exact signed source queries, safe response kinds, public-IP video sources already validated by the backend, server/network errors and retry, abort plus generation guards, replacement consent, delete/upload continuity, manual creation choices and existing edit preservation.

Deferred requests deliberately deliver late results even after abort, including delayed JSON bodies and reverse ordering. Actual parent-composer cases verify save/type locking and cancellation when a fresh draft opens. Synthetic DOM actions are deterministic regression checks; they do not assert trusted browser gestures, live extraction or media playback. No production records or remote video are read/written.

The existing `test-telegram-quick-form.cjs` and `test-telegram-dashboard.cjs` busy-label expectations now use `Đang xử lý video/ảnh...`; media-removal locates the input by its stable placeholder prefix so the article hint can evolve.
