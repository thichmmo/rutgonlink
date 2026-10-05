# Posts dashboard

Manage published/draft posts with domain filtering/selection, a compact modal editor, a Boclink-style Facebook preview card, preview image upload, clipboard paste/drop, fake-video preview, plain/rich/raw content modes, multi-popup bulk creation, duplicate, copy/open/edit/delete and pagination. The Facebook card keeps the demo title, excerpt, slug, timestamp and reaction row in sync with the form and offers both Upload and Dán ảnh actions. Preview uploads are request-scoped so a late response cannot overwrite a newly opened form, and the active form keeps upload errors visible until they are fixed. The rich editor exposes labeled image/video upload, provider-aware video embedding, HTML/Script (admin) and source-mode controls; uploaded media is stored through the authenticated content upload API. The fixed-content modal supports create/edit/delete, active toggle and before/after ordering.

Verify with `pnpm exec eslint app/dashboard/posts`, `node scripts/test-content-media.cjs`, and create one no-popup post plus a multi-popup batch. Confirm the Facebook card updates while editing, paste an image with Dán ảnh, and embed one YouTube and one TikTok video. Uploaded preview/media URLs are served from the persistent app-level `uploads/content` path after cPanel release swaps.
Popup timing is returned with post and popup-option records and is shown in the article list and popup selector as `S …s · T …s · Cooldown …m`, matching the Boclink operator view. The values are read-only here; changing them remains centralized in Popup Manager so every linked article uses the same runtime configuration.

When editing an article whose popup is inactive, the timing preview falls back to
the saved popup record instead of displaying default values. A notice explains
that inactive popups do not gate the public article. Changing the selected popup
resets the preview. Verify with `node scripts/test-popup-timing.cjs` and
`node scripts/test-popup-timing-api.cjs`; check the modal at a 390px viewport.

## Telegram fast template

The toolbar opens the same account-default editor as Settings, with an independent
save button. Create remains disabled until `/api/posts/options` resolves; every new
form copies `telegramDefaults` once. Editing uses the post's saved `telegramSettings`
instead of live defaults. A revision guard prevents a late options response from
reverting an explicit default save. Account changes never rewrite an open draft.

`TelegramPostEditor` keeps CTA/link/disclaimer fields separate from article HTML.
Its fast URL/embed and image/video upload actions append media by default; replacing
content requires an explicit checkbox and confirmation. Plain text is escaped when
converted to rich content. Empty titles/slugs are filled, with generated slugs capped
at the API's 190 characters; user-entered titles/slugs survive insertion. Preview
renders only validated media URLs rather than arbitrary saved HTML.

Both quick uploads and rich-editor uploads are scoped to the mounted form. Pending
uploads disable save and format changes; late results from closed forms are ignored.
The rich editor remains available for ordinary posts and additional content.

Verify: `node scripts/test-telegram-dashboard.cjs` (35 assertions),
`node scripts/test-content-media.cjs` (6 cases), and scoped ESLint for this folder.
Manual: configure account defaults, create using only a video URL, edit an older
post, and confirm its Telegram snapshot remains unchanged after saving new defaults.
