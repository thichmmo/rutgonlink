# Popup click beacon API

- [route.ts](route.ts) records deduplicated `SHOPEE` and `TIKTOK` popup clicks validated by `verifyPopupClickToken(token, postId, popupId, host)`.
- Because the signed click token is emitted only when the server has already verified popup eligibility (including signed `_fbh` Facebook -> Chrome handoffs on Android where Chrome's beacon `User-Agent` has no `FBAN` token), `popupAppliesToDevice` is called with `{ isFacebookSource: true }` so mobile/OS platform toggles remain enforced without dropping legitimate Chrome handoff clicks.
- When an owner swaps a post to a new popup, pauses the previous popup, or deletes the previous popup while visitors are mid-sequence, [route.ts](route.ts) still accepts valid HMAC-signed in-flight clicks for the active post — binding `popupId` when the template still exists under `post.userId` or falling back to `popupId: null` (including across concurrent `P2003` deletes) so post and account totals lose zero clicks.
- Verify: `node scripts/test-popup-clicks.cjs` and `node scripts/test-popup-runtime.cjs`.
- Rollback note (`2026-11-24`): Reverted `4501829` back to `42b9082` because deferring `sendPopupClick` until `visibilitychange === 'hidden'` / `pagehide` dropped `shopeevn://` custom-scheme clicks when iOS suspended WKWebView before flushing the beacon.
