# Default Public Assets (`public/defaults/`)

## Purpose
Contains static default media bundled into standalone releases (`public/defaults/reaction-default.jpg`).

## Behavior
- `reaction-default.jpg` (`600×800`, `3:4` `sRGB` JPEG) is pre-cropped from the top TikTok caption area so all accounts get a clean FaceTime/TikTok Reaction portrait out of the box without duplicating the file per user on disk.

## Verification
- `node scripts/test-reaction-collage.cjs`
