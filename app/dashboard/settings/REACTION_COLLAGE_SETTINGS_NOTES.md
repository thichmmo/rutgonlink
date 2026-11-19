# Reaction Collage Settings Section (`app/dashboard/settings/ReactionCollageSettingsSection.tsx`)

## Purpose
Settings card inside `/dashboard/settings` allowing each user to configure their single fixed Reaction cutout template, toggle auto-collage on/off, upload a custom template (auto-segmenting opaque portraits client-side into transparent PNGs via MediaPipe `selfie_segmenter` when available, with graceful fallback), or restore the default cutout, and pick default corner (`Dưới trái` / `Dưới phải`) and scale (`30%` / `38%` / `46%`).

## Behavior
- Hydrated server-side in `app/dashboard/settings/page.tsx` with `getUserCollageSettings`.
- Renders no Facebook Feed optimization toggles or labels (controlled strictly in Admin `/admin/users` backend).

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx eslint app/dashboard/settings/ReactionCollageSettingsSection.tsx app/dashboard/settings/page.tsx`
