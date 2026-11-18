# Reaction Collage Engine & Storage (`lib/reaction-collage-*.ts`)

## Purpose
Shared configuration (`lib/reaction-collage-config.ts`) and server-side `sharp` compositor, permission gating, and bounded disk history (`lib/reaction-collage-server.ts`) for the FaceTime / TikTok Reaction image collage feature.

## Behavior
- **Default Pre-Cropped Portrait**: Uses `/defaults/reaction-default.jpg` (`600×800`, `3:4`, top caption cropped out) out of the box with `enabled: true` and `corner: 'bottom-right'`.
- **FaceTime / TikTok Reaction Overlay**: Renders a `3:4` rounded-rectangle corner portrait with crisp white border and SVG 1.1 Gaussian drop shadow (`<feGaussianBlur>` + `<feOffset>` + `<feComponentTransfer>` for cross-platform `librsvg` compatibility).
- **Admin-Gated Facebook Feed Optimization (`fb_viral_collage_users`)**:
  - Implicitly enabled for `ADMIN_EMAIL`, `owner`, and `ops`; explicitly toggled per user by Admin via `set-fb-viral-collage`.
  - When authorized & enabled: strips old EXIF/screenshot metadata, outputs `fb-4x5` (`~1638×2048` with blurred ambient backdrop when aspect ratios differ so screenshot text is never cropped), `auto-hd` (`~2048px`), or `fb-1x1`, applies micro-jitter to dimensions/coordinates/scale + subtle `sRGB` brightness/saturation modulation + Lanczos3 sharpening + `mozjpeg` `92%`, and names downloads `IMG_YYYYMMDD_HHMMSS_NNN.jpg`.
  - When unauthorized: enforces standard `<= 1280px` JPEG (`ghep-anh-*.jpg`) regardless of client payload.
- **10-Image Cap & Host Disk Cleanup**: `createUserCollageAndPruneHistory` retains at most `MAX_COLLAGE_HISTORY = 10` items per user in `AppSetting` (`user_collage_history:<userId>`) and immediately `unlink`s evicted `collage-*.jpg` files (as well as replaced/reset `collage-tpl-*.jpg` custom templates) from `uploads/content/`.

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx tsc --noEmit --pretty false`
