# Reaction Collage Settings Section (`app/dashboard/settings/ReactionCollageSettingsSection.tsx`)

## Purpose
Settings card inside `/dashboard/settings` allowing each user to configure their single fixed Reaction portrait template, toggle auto-collage on/off, upload a replacement portrait (or restore the default pre-cropped portrait), and pick default corner/scale/Facebook aspect ratio.

## Behavior
- Hydrated server-side in `app/dashboard/settings/page.tsx` with `getUserCollageSettings` and `canActorUseFbViralCollage`.
- Hides the Facebook Feed optimization section unless `canUseFbViral` is `true` for the current user.

## Verification
- `node scripts/test-reaction-collage.cjs`
- `npx eslint app/dashboard/settings/ReactionCollageSettingsSection.tsx app/dashboard/settings/page.tsx`
