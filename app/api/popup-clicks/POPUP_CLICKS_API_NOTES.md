# Popup click beacon API

- [route.ts](route.ts) records deduplicated `SHOPEE` and `TIKTOK` popup clicks validated by `verifyPopupClickToken(token, postId, popupId, host)`.
- Because the signed click token is emitted only when the server has already verified popup eligibility (including signed `_fbh` Facebook -> Chrome handoffs on Android where Chrome's beacon `User-Agent` has no `FBAN` token), `popupAppliesToDevice` is called with `{ isFacebookSource: true }` so mobile/OS platform toggles remain enforced without dropping legitimate Chrome handoff clicks.
- Verify: `node scripts/test-popup-clicks.cjs` and `node scripts/test-popup-runtime.cjs`.
