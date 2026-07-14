# API v1 category delete notes

## Purpose

Expose the same optional destructive category delete behavior through API keys.

## Behavior

- `DELETE /api/v1/categories/[id]` detaches links by default.
- Passing `{ "deleteLinks": true }` deletes all category links before deleting the category.
- The response reports `deletedLinks` or `detachedLinks`.

## Verification

- Scoped ESLint and TypeScript checks cover this route.
