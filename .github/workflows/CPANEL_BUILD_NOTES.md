# cPanel Linux build

The manual workflow builds the standalone artifact on Linux so native packages such as Sharp match the cPanel runtime. It packages only runtime files, the release commit marker and versioned migration SQL files; secrets are never included.

The build pins `NEXTAUTH_URL=https://rutgonlink.site` and `SITE_NAME=rutgonlink.site` so statically generated canonical, Open Graph, robots and sitemap output cannot fall back to a placeholder hostname.

Verification: dispatch the workflow, download `rutgonlink-cpanel-<sha>`, inspect `RELEASE_COMMIT`, then deploy only after a production database backup.

The PR workflow lint now covers popup/post APIs, fixed content, affiliate resolver and public slug routing. Production health checks also require the unauthenticated dashboard redirect; optional `SMOKE_POST_URL` and `SMOKE_SHORT_URL` secrets exercise known published URLs after deployment.

The deploy workflow also runs `node scripts/test-popup-runtime.cjs` and
`node scripts/test-content-upload-path.cjs` before packaging. The latter covers
local, live standalone, staged standalone, configured-directory, and upload
round-trip behavior.
It compiles the generated inline JavaScript and mounts the real React popup with
storage/navigation mocks to catch iOS/Facebook handoff regressions before release.

Timing checks now include public timer/progress synchronization, zero seconds,
dashboard preview lifecycle/cleanup, normalization, and owner-scoped API responses.
Run `node scripts/test-popup-timing.cjs` and `node scripts/test-popup-timing-api.cjs`
alongside the runtime suite before deployment.

Popup click analytics has a dedicated CI regression step and lint coverage for
the event API, statistics API, aggregation helpers and dashboard components.
Run `node scripts/test-popup-clicks.cjs`; the runtime suite also captures real
beacon payloads to assert one event per ready click before affiliate navigation.

The runtime suite also checks the shared preopened DevTools guard and no-JS
server markup on both public renderers; lint includes `lib/public-post-guard.ts`.

Telegram template releases add nullable JSON columns before swapping the live
runtime. CI verifies account isolation/default snapshots, legacy compatibility,
both public renderers and quick-editor UI. Run `node scripts/test-telegram-api.cjs`,
`node scripts/test-telegram-render.cjs` and `node scripts/test-telegram-dashboard.cjs`.
Rollback should retain additive columns/data and redeploy the prior runtime.
# Fixed content in the post composer (2026-10-05)

The focused `node scripts/test-fixed-content-composer.cjs` suite runs before packaging, and is included in scoped lint. It protects the create/edit dialog shortcut, account-wide block controls, and preservation of the unsaved post/Telegram draft while managing fixed content.

## Separate post types (2026-10-05)

Run `node scripts/test-post-types-api.cjs` and `node scripts/test-post-types-dashboard.cjs` before packaging. These protect explicit normal/Telegram creation, type-filtered pagination and legacy JSON-null handling, plus draft preservation. No schema migration is added for the split.

## Compact Telegram composer (2026-10-05)

`node scripts/test-telegram-quick-form.cjs` runs with the Telegram suites and scoped lint. It protects media/popup-only creation, hidden optional metadata validation, existing-content preservation, and the unchanged normal-post editor. The UI change adds no migration.

## TikTok affiliate URL isolation (2026-10-07)

`node scripts/test-popup-affiliate.cjs` covers Android-source preservation, iOS-only conversion, shared 8192-character input/output/persistence validation, warnings and stale UI requests. Run it before packaging; scoped lint includes the URL validator and harness. No schema migration is required because popup destinations already use TEXT/JSON storage.


## Android browser handoff verification (2026-10-07)

Production lint includes `lib/popup-browser-gate.ts` and the iOS-only request
preparation helper. Runtime checks cover raw Android HTTPS actions, gate isolation
and legacy native-builder syntax. Four isolated HTTPS real-phone trials passed:
standalone/React through Facebook→Chrome and directly in Chrome, retaining human
Facebook confirmation and TikTok's shared-card→native PDP gesture. Countdown,
return, cooldown-zero reload and two accepted fixture clicks per original trial
passed; six tested source hashes matched. iOS remains automated-only. Pushing main
triggers deployment; Actions/runtime and production analytics need separate checks.

## Numeric Telegram links and media controls (2026-10-07)

CI runs `node scripts/test-numeric-post-links.cjs` for numeric URL allocation,
collision retries, existing links and host/publication isolation, plus
`node scripts/test-rich-editor-video.cjs` for video selection/removal without
persisting editor controls. The quick-form suite also verifies Telegram creation
defaults, deleted-popup replacement and individual media removal. The new `/p7`
route and link helpers are included in scoped lint. No schema migration is added.
`node scripts/test-telegram-media-removal.cjs` additionally verifies individual
quick-media deletion, signed sibling URLs and preservation of mixed article HTML.

## Admin daily popup clicks (2026-10-07)

CI runs the admin popup-click API and UI suites before release. Counts use the
Vietnam-day boundary and accepted `PopupClick` events, separate from lifetime
short-link clicks. Coverage includes authorization, page/user isolation, midnight,
platform breakdowns, zero values, manual refresh and existing user actions.
Scoped lint includes both admin user endpoints/pages and the aggregation helper.
After deployment, both admin read endpoints must still return 403 without an
authorized session. No database migration is required.
