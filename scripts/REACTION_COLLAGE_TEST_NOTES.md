# Reaction Collage Test Suite (`scripts/test-reaction-collage.cjs`)

## Purpose
End-to-end automated regression suite covering transparent corner cutout compositing, silent backend-only Facebook optimization, 10-image disk pruning, custom cutout cleanup, legacy settings migration, and compact `ReactionCollageStudio` UI interactions.

## Behavior
- Verifies `public/defaults/reaction-default.png` exists with RGBA alpha channel, transparent upper corners, and opaque bottom pixels.
- Verifies unauthenticated requests to `/api/collage` and `/api/settings/collage` return `401`.
- Verifies flush bottom-left and bottom-right cutout compositing leaves transparent upper areas untouched without rectangular borders or margins.
- Verifies user JSON endpoints never expose `canUseFbViral` or `fbOptimized`, while Admin `PATCH /api/admin/users/[id]` (`set-fb-viral-collage`) toggles `~2048px` HD output, stripped EXIF metadata, unique SHA-256 hashes per export, and `IMG_*.jpg` filenames in backend only.
- Verifies generating 12 images retains 10 items and `unlink`s evicted `collage-*.jpg` and replaced/reset `collage-tpl-*.png` files on disk, plus auto-migration from `/defaults/reaction-default.jpg`.
- Verifies `ReactionCollageStudio` JSDOM click-to-paste (`Dán ảnh`), compact `h-36 w-36` preview card, absence of any FB viral UI/badges, and PNG `ClipboardItem` copy.

## Verification
- `node scripts/test-reaction-collage.cjs`
