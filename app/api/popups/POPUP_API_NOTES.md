# Popup API

List/create and owner-scoped update/delete endpoints manage reusable two-destination templates. Deletion sets assigned posts' popup ID to null through the database relation.

Verify with `npx eslint app/api/popups` and an authenticated create/update/delete smoke test.
