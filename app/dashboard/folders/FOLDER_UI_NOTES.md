# Folder UI notes

## Purpose

Keep the active-folder preview in sync after folder changes.

## Behavior

- Create, edit, and delete now reload the active preview after the folder list refreshes.
- This prevents stale or misleading active-folder display after deleting a folder.

## Verification

- Scoped ESLint covers the folders dashboard page.
