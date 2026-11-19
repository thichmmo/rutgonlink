# Reaction Collage Settings API (`app/api/settings/collage/route.ts`)

## Purpose
Authenticated API managing each user's fixed Reaction cutout template and default corner/size preferences (`user_collage_settings:<userId>`).

## Behavior
- `GET`: Returns `{ settings }`.
- `PUT`: Validates partial updates (`enabled`, `templateImageUrl`, `corner`, `scalePercent`) with Zod; resetting `templateImageUrl` to `/defaults/reaction-default.png` automatically deletes the previous `collage-tpl-*` file on disk.
- `POST`: Normalizes a newly uploaded cutout PNG/image (`normalizeCutoutTemplatePng`), stores it under `uploads/content/collage-tpl-<uuid>.png`, and unlinks any previous custom template file for that user.

## Verification
- `node scripts/test-reaction-collage.cjs`
