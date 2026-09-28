# Public social image

Only published posts owned by an active account expose preview bytes. Images are
served as 1200x630 JPEGs; the optional play icon is baked into the actual image.
Uploads/data images stay local. Remote images use public-only, pinned DNS,
bounded redirects, byte/pixel limits and an 8-second network deadline. Errors
are not cached; successful requests coalesce in a bounded 5-minute memory cache.

Verify with `node scripts/test-content-media.cjs` and a crawler GET of the image
URL from the public post HTML. Draft/missing images must return 404.
