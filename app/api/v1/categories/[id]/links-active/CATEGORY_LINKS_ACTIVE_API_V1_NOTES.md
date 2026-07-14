# Category links active API v1 notes

## Purpose
Expose category-level link activation toggles to API-key clients for testing and automation.

## Behavior
- `PATCH /api/v1/categories/[id]/links-active` accepts `{ "isActive": boolean }`.
- The API key owner must own the category.
- Every link in the category is updated, and each short-code cache entry is invalidated.

## Verification
- `npx.cmd eslint components/CategoriesTab.tsx "app/api/categories/[id]/links-active/route.ts" "app/api/v1/categories/[id]/links-active/route.ts"` passes with 0 errors.
- Temporary scoped TypeScript check for the category UI and both bulk active routes passes.
