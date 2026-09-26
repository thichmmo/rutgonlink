# Public managed post route

The root `domain/slug` route checks published managed posts before short links. It filters by primary/shared/verified custom domain, renders fixed content and preview metadata, keeps `/posts/slug` as an alias, and runs the two-step popup in the current session. If no post matches, the existing short-link flow is unchanged.

Verify with `pnpm exec eslint 'app/[shortCode]/route.ts'` plus root-post, alias and short-link smoke requests.
