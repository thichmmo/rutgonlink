# Public managed post

Published posts render at `/posts/{slug}`. Their text is escaped by React; a selected popup covers the article until two separate user clicks open its destinations in new tabs. A blocked tab does not advance. Progress persists in the current browser session and resets when the popup template changes.

Verify with `npx eslint 'app/posts/[slug]'`, then test both clicks, tab blocking, refresh and a no-popup post on desktop/mobile.
