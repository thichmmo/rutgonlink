# Numeric `/p7` Anti-404 Fallback Settings API

- `GET /api/settings/post-fallback` and `PUT /api/settings/post-fallback` (`{ enabled: boolean }`) read and update `User.numericFallbackEnabled` for the authenticated managed-content actor, returning `{ enabled, numericFallbackEnabled }`.
- Unauthenticated callers receive `401`; malformed JSON or non-boolean payloads receive `400`.
- Verify: `node scripts/test-numeric-post-links.cjs` and `node scripts/test-telegram-quick-form.cjs`.
