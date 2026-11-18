# Reaction Collage API (`app/api/collage/route.ts`)

## Purpose
Authenticated API for listing, composing, and deleting per-user Reaction collage images.

## Behavior
- `GET`: Returns `{ settings, canUseFbViral, items }` with `Cache-Control: private, no-store`.
- `POST`: Accepts `multipart/form-data` (`file` up to 12 MB + optional `corner`, `scalePercent`, `aspectPreset`, `fbViralEnabled`), verifies `canActorUseFbViralCollage` server-side, composes the Reaction image, saves to `uploads/content/collage-<uuid>.jpg`, and prunes history + disk files beyond the 10 most recent items.
- `DELETE`: Deletes a single item (`?id=<id>`) or clears all 10 items (`?all=1`) and removes the backing `.jpg` files from `uploads/content/`.

## Verification
- `node scripts/test-reaction-collage.cjs`
