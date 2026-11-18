# Admin Post Fallback UI (`app/admin/post-fallback/page.tsx`)

## Purpose
Admin-only screen (`/admin/post-fallback`) to toggle and configure the global destination URL for deleted/missing `/p7/<code>` and `/posts/<slug>` article links across the system.

## Behavior
- Reads and updates `/api/admin/post-fallback` (`system.read` / `system.write`).
- Lets the admin paste any internal `/p7/...` or external `https://...` URL, or pick from the admin's own published posts / Direct Wrapper items in one click.
- Shows live backend resolution status (in-place internal post + Popup vs `302` external redirect). Regular users in `/dashboard` never see this setting.

## Verification
- `npx tsc --noEmit --pretty false`
- `npx eslint app/admin/post-fallback app/api/admin/post-fallback`
