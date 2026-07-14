# Category bulk active notes

## Purpose
Allow users to toggle every link in a category without opening and editing each link row.

## Behavior
- Category rows show a power icon action next to view/edit/delete.
- If a category has active links, the action disables all links in that category.
- If a category has zero active links, the action enables all links in that category.
- The category and current link list reload after the bulk action succeeds.

## Verification
- `npx.cmd eslint components/CategoriesTab.tsx "app/api/categories/[id]/links-active/route.ts" "app/api/v1/categories/[id]/links-active/route.ts"` passes with 0 errors.
- Temporary scoped `npx.cmd tsc --noEmit --pretty false --incremental false --project tsconfig.category-bulk-check.json` passes.
