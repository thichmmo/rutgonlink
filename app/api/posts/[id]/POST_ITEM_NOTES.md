# Post item API

Updates/deletes require both the ID and session owner; updates recheck popup ownership. Verify with `npx eslint app/api/posts`.

The updated post includes the linked popup's saved settings for the dashboard timing
summary. The owner filter remains on both update and reread. Verify with
`node scripts/test-popup-timing-api.cjs`.

## Telegram snapshot updates

An omitted `telegramSettings` field leaves the stored snapshot untouched for older
clients. An explicit complete settings object is validated and updates only the
actor-owned post. Account defaults are never read for edits.
Verify with `node scripts/test-telegram-api.cjs`.
