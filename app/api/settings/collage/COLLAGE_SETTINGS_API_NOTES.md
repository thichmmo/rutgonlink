# Reaction Collage Settings API (`app/api/settings/collage/route.ts`)

## Purpose
Authenticated API managing each user's fixed Reaction template and default collage preferences (`user_collage_settings:<userId>`).

## Behavior
- `GET`: Returns `{ settings, canUseFbViral }`.
- `PUT`: Validates partial updates (`enabled`, `templateImageUrl`, `corner`, `scalePercent`, `aspectPreset`, `fbViralEnabled`) with Zod; resetting `templateImageUrl` to `/defaults/reaction-default.jpg` automatically deletes the previous `collage-tpl-*.jpg` file on disk.
- `POST`: Normalizes a newly uploaded custom portrait template to `600×800` (`3:4` `sRGB` JPEG), stores it under `uploads/content/collage-tpl-<uuid>.jpg`, and unlinks any previous custom template file for that user.

## Verification
- `node scripts/test-reaction-collage.cjs`
