# Reaction Collage Test Suite (`scripts/test-reaction-collage.cjs`)

## Purpose
End-to-end automated regression suite covering Reaction image compositing, Admin-gated Facebook Feed optimization, 10-image disk pruning, custom template cleanup, and `ReactionCollageStudio` UI interactions.

## Behavior
- Verifies `public/defaults/reaction-default.jpg` exists (`600×800` JPEG) and unauthenticated requests to `/api/collage` and `/api/settings/collage` return `401`.
- Verifies unauthorized accounts receive standard `<= 1280px` output even if submitting `fbViralEnabled=true`, while accounts granted access via `PATCH /api/admin/users/[id]` (`action: 'set-fb-viral-collage'`) receive `4:5` HD (`~1638×2048`), stripped EXIF metadata, unique SHA-256 hashes per export, and `IMG_*.jpg` filenames.
- Verifies generating 12 images retains exactly 10 items and physically `unlink`s evicted `collage-*.jpg` and replaced/reset `collage-tpl-*.jpg` files on disk.
- Verifies `ReactionCollageStudio` JSDOM click-to-paste (`navigator.clipboard.read`), conditional FB viral controls, and PNG `ClipboardItem` copy (`navigator.clipboard.write`).

## Verification
- `node scripts/test-reaction-collage.cjs`
