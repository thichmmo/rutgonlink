# Public managed post route

The root `domain/slug` route checks published managed posts before short links. It filters by primary/shared/verified custom domain, renders fixed content and preview metadata, keeps `/posts/slug` as an alias, and runs the two-step popup in the current session. The inline runtime commits the next step before opening an external URL, keeps a short-lived local-storage/cookie handoff for webviews that reopen a fresh tab, and resumes it through mobile page lifecycle events. Blur/focus signals cover webviews that keep `visibilityState` visible, while mobile null `window.open` results keep the committed step instead of replaying Shopee. If no post matches, the existing short-link flow is unchanged.

Verify with `pnpm exec eslint 'app/[shortCode]/route.ts'` plus root-post, alias and short-link smoke requests.
