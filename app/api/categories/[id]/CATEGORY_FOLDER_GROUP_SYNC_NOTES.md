# Category folder group sync notes

## Purpose

Changing a category's folder group should move existing category links to the new group's folders.

## Behavior

- `PATCH /api/categories/[id]` detects `folderGroupId` changes and already-saved groups with stale link assignments.
- When sync is needed, all links in that category have stale folder assignments replaced by folders from the selected group.
- Link cache entries are invalidated by the shared sync helper.

## Verification

- Run scoped ESLint for this route and the shared folder rotation helper.
