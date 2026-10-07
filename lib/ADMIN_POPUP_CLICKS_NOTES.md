# Admin daily popup clicks

Admin user rows and user detail aggregate only recorded `PopupClick` events for the selected user IDs. Shopee/TikTok counts and their total cover Vietnam midnight through the request's shared timestamp, matching dashboard popup analytics. Empty users receive zeros; no redirect `Click` count is added. The query groups in the database without loading event rows and uses the existing `(userId, createdAt)` index.

Verification: `node scripts/test-admin-popup-clicks.cjs` covers day boundaries, selected-user isolation, zero counts, admin API permissions, and separation from lifetime short-link clicks.
