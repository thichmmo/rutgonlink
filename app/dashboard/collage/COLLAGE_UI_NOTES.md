# Reaction Collage Studio UI (`app/dashboard/collage/`)

## Purpose
Dedicated **Ghép ảnh** tab (`/dashboard/collage`) for 1-click pasting or uploading images to overlay the user's fixed FaceTime / TikTok Reaction portrait.

## Behavior
- Hydrates `initialSettings`, `initialCanUseFbViral`, and `initialItems` server-side in `page.tsx`.
- Provides direct clickable **`Dán ảnh`** (`navigator.clipboard.read()` without needing `Ctrl+V`) and **`Upload ảnh`** buttons, plus drag-and-drop and window `paste` support.
- Quick corner, frame size, and (when `canUseFbViral` is granted by Admin) **Chuẩn đề xuất FB** aspect-ratio controls re-compose the active session image immediately.
- **`Copy ảnh`** writes a PNG `ClipboardItem` promise (`navigator.clipboard.write`) to preserve Safari/Chrome user activation, alongside **`Tải ảnh về`** and a 10-item recent gallery with single/all delete.

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx eslint app/dashboard/collage`
