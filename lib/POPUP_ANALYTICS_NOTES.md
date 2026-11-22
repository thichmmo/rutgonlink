# Popup click analytics queries

- [popup-analytics-server.ts](popup-analytics-server.ts) computes Vietnam-day (`Asia/Ho_Chi_Minh`) Shopee/TikTok click windows for account totals (`getPopupClickTotals`), batch badge counts (`getPopupClickCounts`), and paginated post/popup tables (`getPopupClickList`).
- Because `PopupClick.postId` and `PopupClick.popupId` use `ON DELETE SET NULL`, `getPopupClickTotals` retains all user clicks after popup/post cleanup, post counts remain intact when an old popup is deleted, and `getPopupClickList` filters `${key} IS NOT NULL` in its grouped subquery.
- Verify: `node scripts/test-popup-clicks.cjs` and `node scripts/test-admin-popup-clicks.cjs`.
