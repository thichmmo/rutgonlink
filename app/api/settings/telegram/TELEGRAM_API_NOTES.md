# Account Telegram defaults

GET and PUT return the settings object directly. The actor is resolved through
the existing active-user authentication helper and every query uses `actor.id`;
admins do not gain cross-account access. PUT validates the complete strict object,
updates only `User.telegramSettings`, and never rewrites existing posts.

Verify: `node scripts/test-telegram-api.cjs` covers unauthenticated requests,
tenant isolation, validation, saved defaults, and unchanged historical snapshots.
