# Link category folder sync notes

## Purpose

Changing a link's category should not leave it rotating through folders from the previous category group.

## Behavior

- `PATCH /api/links/[id]` detects category changes.
- If the new category has a folder group, the link's folder assignments are replaced with that group's folders.
- The shared sync helper invalidates the affected short-code cache.

## Verification

- Run scoped ESLint for this route and the shared folder rotation helper.
