# TikTok affiliate navigation notes

## Purpose

Expose the TikTok affiliate converter as a first-class dashboard item.

## Behavior

- Desktop sidebar and mobile drawer include `TikTok AFF` linking to `/dashboard/tiktok-link`.
- The compact mobile bottom bar is unchanged to avoid overcrowding its primary destinations.

## Verification

- Scoped ESLint passes.
- Production build and deployment health checks pass with the new navigation entry included.
