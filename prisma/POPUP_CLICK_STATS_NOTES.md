# Popup click schema

- `PopupClick` stores one idempotent Shopee/TikTok open event (`eventId` `@unique`) with indexes for user, post, popup, and time-window queries.
- `postId` and `popupId` are nullable (`ON DELETE SET NULL` in `20261122000000_preserve_popup_clicks_on_delete`) so deleting an old `PopupTemplate` or `ManagedPost` never cascade-deletes historical or daily click totals.
- Verify: `/usr/local/bin/npx prisma validate` and `node scripts/test-popup-clicks.cjs`.
