# cPanel Linux build

The manual workflow builds the standalone artifact on Linux so native packages such as Sharp match the cPanel runtime. It packages only runtime files, the release commit marker and the required admin migration; secrets are never included.

Verification: dispatch the workflow, download `rutgonlink-cpanel-<sha>`, inspect `RELEASE_COMMIT`, then deploy only after a production database backup.
