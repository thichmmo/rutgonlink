# Reaction Collage Engine & Storage (`lib/reaction-collage-*.ts`)

## Purpose
Shared configuration (`lib/reaction-collage-config.ts`) and server-side `sharp` compositor, silent backend FB permission gating, and bounded disk history (`lib/reaction-collage-server.ts`).

## Behavior
- **Default Transparent Cutout**: Uses `/defaults/reaction-default.png` (RGBA cutout with top caption and bottom blanket removed) with `enabled: true`, `corner: 'bottom-left'`, `scalePercent: 38`. Legacy `'/defaults/reaction-default.jpg'` / `'top-left'` / `'top-right'` settings auto-migrate in `normalizeUserCollageSettings`.
- **Flush Corner Overlay**: Composites the transparent RGBA cutout flush against `bottom-left` or `bottom-right` (`0px` margin, no rectangular frame/border/shadow), preserving original source aspect ratio. Custom template uploads pass through `normalizeCutoutTemplatePng` to trim outer transparent margins and save `collage-tpl-<uuid>.png`.
- **Silent Backend-Only Facebook Optimization (`fb_viral_collage_users`)**:
  - Implicitly enabled for `ADMIN_EMAIL`, `owner`, and `ops`; toggled per user by Admin in `/admin/users` (`set-fb-viral-collage`).
  - Executed 100% silently in backend when authorized: scales longest edge to `~2048px` (`lanczos3`), strips old EXIF/screenshot metadata, applies subtle `sRGB` brightness/saturation/dimension/scale variation + Lanczos3 sharpening + `mozjpeg` `92%`, and names downloads `IMG_YYYYMMDD_HHMMSS_NNN.jpg` (vs `<= 1280px` and `ghep-anh-*.jpg` when disabled). Never exposed in user API responses or user UI.
- **10-Image Cap & Host Disk Cleanup**: `createUserCollageAndPruneHistory` retains at most `MAX_COLLAGE_HISTORY = 10` items per user in `AppSetting` and immediately `unlink`s evicted `collage-*.jpg` and replaced/reset `collage-tpl-*.(jpg|png|webp)` files on disk.

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx tsc --noEmit --pretty false`
