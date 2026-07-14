# Category links active notes

## Purpose
Bulk-update `isActive` for all links owned by the current user in a single category.

## Behavior
- `PATCH /api/categories/[id]/links-active` accepts `{ "isActive": boolean }`.
- The route verifies the category belongs to the session user before updating links.
- All affected short-code cache entries are invalidated after the bulk update.

## Verification
- `npx.cmd eslint components/CategoriesTab.tsx "app/api/categories/[id]/links-active/route.ts" "app/api/v1/categories/[id]/links-active/route.ts"` passes with 0 errors.
- Temporary scoped `npx.cmd tsc --noEmit --pretty false --incremental false --project tsconfig.category-bulk-check.json` passes.
