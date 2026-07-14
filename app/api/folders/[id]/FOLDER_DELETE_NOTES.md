# Folder delete notes

## Purpose

Dashboard folder deletion must not shift today's active folder when another folder earlier in the rotation is removed.

## Behavior

- The route delegates deletion to the shared rotation-preserving helper.
- The helper adjusts affected rotating links before deleting the folder.
- Response includes affected/adjusted counts for debugging.

## Verification

- Scoped ESLint and a focused rotation deletion scenario check cover this route.
