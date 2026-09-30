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
