# Default Public Assets (`public/defaults/`)

## Purpose
Contains static default media bundled into standalone releases (`public/defaults/reaction-default.png`).

## Behavior
- `reaction-default.png` is an RGBA transparent person cutout (`623×698`) segmented cleanly from the user-provided portrait (with top TikTok caption and bottom blanket cropped out so the figure sits flush against `bottom-left` or `bottom-right` image corners).

## Verification
- `node scripts/test-reaction-collage.cjs`
