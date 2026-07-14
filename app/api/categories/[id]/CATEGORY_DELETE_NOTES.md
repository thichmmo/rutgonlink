# Category delete notes

## Purpose

Allow dashboard category deletion to either keep category links or delete them too.

## Behavior

- `DELETE /api/categories/[id]` keeps the old behavior by default: links are detached with `categoryId = null`.
- Passing `{ "deleteLinks": true }` deletes all links in the category before deleting the category.
- Link cache entries are invalidated for affected short codes.

## Verification

- Scoped ESLint and TypeScript checks cover this route and the category UI.
