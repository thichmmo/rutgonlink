# Daily popup counts on user detail

The existing `users.read` GET returns `user.popupClicksToday` with Shopee, TikTok and total counts plus top-level Vietnam timezone/as-of metadata. A missing user returns 404 before aggregation. Existing account fields/actions, related records, lifetime Link clicks and API-key redaction are preserved.

Verification: `node scripts/test-admin-popup-clicks.cjs` covers authorization, target-user isolation, zeros, missing users and secret redaction.
