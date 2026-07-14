# API v1 folder delete notes

## Purpose

API-key folder deletion follows the same rotation-preserving behavior as dashboard deletion.

## Behavior

- Deletion uses the shared folder rotation helper.
- If a previous folder is removed, today's active folder remains the same folder ID for affected links.
- The response returns affected/adjusted counts.

## Verification

- Scoped ESLint and a focused rotation deletion scenario check cover this route.
