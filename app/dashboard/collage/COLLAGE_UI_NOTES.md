# Reaction Collage Studio UI (`app/dashboard/collage/`)

## Purpose
Dedicated **Ghép ảnh** tab (`/dashboard/collage`) for 1-click pasting or uploading images to overlay the user's fixed transparent cutout template flush in the bottom corner.

## Behavior
- Hydrates `initialSettings` and `initialItems` server-side in `page.tsx` without exposing any backend FB optimization flags or badges.
- Provides direct clickable **`Dán ảnh`** (`navigator.clipboard.read()` without needing `Ctrl+V`) and **`Upload ảnh`** buttons, plus drag-and-drop and window `paste` support.
- Quick corner (`Dưới trái`, `Dưới phải`) and cutout size (`Nhỏ` `30%`, `Vừa` `38%`, `Lớn` `46%`) controls re-compose the active session image immediately.
- Displays the active composed image in a compact horizontal card (`max-w-lg`, `h-36 w-36 sm:h-40 sm:w-40` thumbnail) alongside **`Copy ảnh`** (PNG `ClipboardItem` promise) and **`Tải ảnh về`**, plus a compact `10`-item recent history grid.

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx eslint app/dashboard/collage`
