# Content management validation

Both management APIs use the same session lookup, URL validation and popup ownership check. Only HTTP(S) destinations are accepted; article content is rendered as text, not raw HTML.

Verify with `npx tsc --noEmit` and the targeted ESLint command for the new routes.
