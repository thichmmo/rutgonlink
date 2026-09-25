# Video-style intermediate page

The short-link route renders the optional fake video screen only when a link opts in; the default path remains a direct `302` redirect. Create/edit APIs persist the toggle and optional HTTP(S) or uploaded image, with the route validating the image before embedding it.

Verification: `npx tsc --noEmit -p tsconfig.root-check.json --pretty false`; `npx prisma validate`.

Shared-domain routing: links created with a configured shared domain are looked up by both `shortCode` and `sharedDomain`; the main domain keeps its existing fallback behavior, while unknown hosts no longer resolve domainless links.

Verification: `npx tsc --noEmit -p tsconfig.root-check.json --pretty false`; request a shared-domain short URL and confirm it resolves the same link as the main-domain URL.
