# cPanel Linux build

The manual workflow builds the standalone artifact on Linux so native packages such as Sharp match the cPanel runtime. It packages only runtime files, the release commit marker and versioned migration SQL files; secrets are never included.

The build pins `NEXTAUTH_URL=https://rutgonlink.site` and `SITE_NAME=rutgonlink.site` so statically generated canonical, Open Graph, robots and sitemap output cannot fall back to a placeholder hostname.

Verification: dispatch the workflow, download `rutgonlink-cpanel-<sha>`, inspect `RELEASE_COMMIT`, then deploy only after a production database backup.

The PR workflow lint now covers popup/post APIs, fixed content, affiliate resolver and public slug routing. Production health checks also require the unauthenticated dashboard redirect; optional `SMOKE_POST_URL` and `SMOKE_SHORT_URL` secrets exercise known published URLs after deployment.
