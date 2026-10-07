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
form copies reusable `telegramDefaults` fields once; its explicit creation button chooses the enabled state. Editing uses the post's saved `telegramSettings`
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
The rich editor remains available for ordinary posts only; Telegram drafts use the media-only composer described below.

Verify: `node scripts/test-telegram-dashboard.cjs` (35 assertions),
`node scripts/test-content-media.cjs` (6 cases), and scoped ESLint for this folder.
Manual: configure account defaults, create using only a video URL, edit an older
post, and confirm its Telegram snapshot remains unchanged after saving new defaults.

## Fixed content inside the composer

Both standard and Telegram create/edit forms retain `FixedContentSection` inside the composer (under optional settings for Telegram). Its
account-scoped GET summarizes active before/after blocks; inactive blocks are
counted but never presented as applied. The shortcut opens the existing manager
above the composer, not as a nested form. The composer stays mounted and inert,
preserving title, media, Telegram settings and popup selections; closing the
manager refreshes the summary and returns focus to the shortcut captured before
the composer becomes inert.

Blocks retain their existing global live-render behavior: saving a block changes
all the account's posts, including Telegram posts, and never copies block HTML
into a draft or submits the post form. Both surfaces explain this explicitly.
Block requests and errors are independent of post saves; late summary responses
after closing/reopening the composer are ignored. The block manager traps keyboard
focus, handles Escape when idle and prevents closing/editing during mutations.
Manager reads are revision/lifetime scoped: mutation start invalidates an initial
pending GET so its older list or error cannot overwrite the post-save result.

Verify: `node scripts/test-fixed-content-composer.cjs`,
`node scripts/test-telegram-dashboard.cjs` and `pnpm exec eslint app/dashboard/posts`.
Manual: enter a draft, open fixed content, add/enable a before/after block, close
the manager and confirm the summary changes without losing the draft. Repeat
with an existing Telegram post and a failed content-block GET.

## Separate standard and Telegram posts

The toolbar has explicit `Tạo bài thường` and `Tạo bài Telegram` actions. Both
snapshot reusable account URL/text fields, but their explicit type overrides the
account preference. The account preference remains visible and retains existing
API behavior. Standard forms omit all Telegram settings/media-preview UI; Telegram
forms show it without a second enable checkbox. The type selector changes only
`telegramSettings.enabled`, preserving draft media, popup/domain selections,
preview image, and per-post Telegram link/text; it locks during save or any upload.
For standard saves only, disabled Telegram fields are normalized in the payload so
an invalid hidden URL or empty button label cannot block saving; valid disabled
snapshots remain unchanged and the draft is never rewritten during mode changes.
Editing and duplication continue to use the saved post snapshot, not live defaults.
Fixed content stays available inside both composer types.

List buttons send `type=all|standard|telegram` to the API alongside existing search,
status, domain, and pagination filters; a type change resets page 1. All cards show
a type badge using strict boolean `enabled === true`. A request generation guards
records, counts, options, and errors when filters change rapidly. Loading hides the
prior list; a failed current request clears its rows/count and offers a retry rather
than showing stale records under the new type. List errors are separate from form
validation and clear on retry without clearing a draft's error.

Verify: `node scripts/test-post-types-dashboard.cjs`,
`node scripts/test-telegram-dashboard.cjs`,
`node scripts/test-fixed-content-composer.cjs`, and
`pnpm exec eslint app/dashboard/posts app/dashboard/settings/TelegramSettingsFields.tsx app/dashboard/settings/TelegramSettingsSection.tsx`.


## Compact Telegram composer

Telegram create/edit renders only the quick URL/upload media tools and popup /
publish controls in the main flow. No RichEditor, article-body textarea or content
format selector is mounted for this type. Facebook preview, title/slug, domain,
excerpt and the fixed-content manager shortcut remain in the collapsed `Tùy chọn
bài viết` section. Standard layout is unchanged. Telegram link/button/disclaimer
reuse the saved snapshot; their settings open automatically when a link is missing
or validation fails. The media layout preview is collapsed until requested.

Media insertion and save fill missing metadata, without replacing entered title,
stored link or content. Empty Telegram content gets a media-specific validation
message. Telegram disables native form validation because optional inputs may be
collapsed: save explicitly validates title, existing editable slugs and Telegram settings,
while server rejection opens the optional controls. Existing text/plain/raw posts
remain intact on edit and mode switch. Replacing the entire body still requires
explicit confirmation; individual deletion removes only the selected media.
A legacy text-only post shows a preservation notice.
Uploading continues to lock Save and the type selector.

Verify: `node scripts/test-telegram-quick-form.cjs`, existing Telegram/post-type/
fixed-content dashboard suites, and `pnpm exec eslint app/dashboard/posts`.
Manual: create with saved Telegram defaults using only video URL + popup; open
optional settings to manage fixed content; switch both modes and edit a legacy
plain/raw post without losing its stored body.

## Telegram creation defaults and numeric links

`Tạo bài Telegram` selects `honghotngay228.site` when present in permitted domain
options, enables publishing, and selects the first active popup. The options API
orders popups newest-first. Missing preferred domain falls back to the primary
domain; missing popups remain empty. These defaults run once for a new form,
without rewriting existing posts or draft fields when type/defaults change.

Returning focus to the dashboard refreshes options before creation and during drafts. An automatic
popup choice that disappeared falls back to the newest valid option; a still-valid
choice stays selected. Checkbox interaction disables automatic selection for that
draft, including an intentional empty selection. Removed manual IDs are discarded
without choosing substitutes. Refresh never resets domain, publish state, media or
metadata, and a late response cannot apply these defaults to an edit/standard form.

New Telegram saves omit `slug` and request `publicLinkMode: 'numeric'`; the API
allocates `/p7/<code>`. Slug inputs are hidden only during new Telegram creation.
Standard posts and every edit retain the existing slug contract. List text, open
and copy use the API's canonical `publicUrl`. Media removal updates content through
`onContentChange`, preserving title/link and content format.

Verify: `node scripts/test-telegram-quick-form.cjs` (162 assertions),
`node scripts/test-telegram-dashboard.cjs` (35),
`node scripts/test-post-types-dashboard.cjs` (78), and
`node scripts/test-fixed-content-composer.cjs` (60). These are actual TSX/JSDOM tests
with local API fixtures; backend allocation/routing has separate coverage.
