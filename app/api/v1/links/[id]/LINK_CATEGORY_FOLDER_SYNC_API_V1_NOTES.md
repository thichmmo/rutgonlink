# API v1 link category folder sync notes

## Purpose

API-driven category changes should keep folder rotation assignments aligned with the category folder group.

## Behavior

- `PATCH /api/v1/links/[id]` detects category changes made with an API key.
- If the new category has a folder group, assignments are synced to that group and the response is refetched after sync.
- This prevents API-created or API-updated links from keeping stale folders from an older group.

## Verification

- Run scoped ESLint for this route and the shared folder rotation helper.
