# Category delete options notes

## Purpose

Let users choose whether deleting a category should keep or delete the links inside it.

## Behavior

- The delete icon opens an in-app modal, not a native browser confirm.
- The modal has an explicit cancel action that closes without calling the API.
- Categories with links offer two delete choices: delete only the category, or delete the category and its links.
- The UI sends `deleteLinks` to the category delete API and refreshes after success.

## Verification

- Scoped ESLint and TypeScript checks cover `CategoriesTab`.
