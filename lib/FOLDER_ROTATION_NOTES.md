# Folder rotation notes

## Purpose

Keep daily folder rotation stable when a folder is deleted.
Keep link folder assignments aligned when a category is moved to a different folder group.

## Behavior

- Active folder selection is still derived from `folderRotationStartDate` and assignment index.
- Before deleting a folder, rotating links that use that folder now have `folderRotationStartDate` realigned so today's active folder keeps the same folder ID when it still exists.
- If the active folder itself is deleted, rotation moves to the next remaining folder for today.
- Link and folder-index caches are cleared after deletion.
- `syncCategoryLinksToFolderGroup` replaces stale link assignments with the folders in the category's current folder group.
- If the selected folder group has no folders, affected links are cleared and folder rotation is disabled so they do not continue using an old group.

## Verification

- Scoped ESLint and source-level rotation scenario checks cover the changed files.
