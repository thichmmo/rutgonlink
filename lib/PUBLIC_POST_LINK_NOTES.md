# Numeric public post links

The `p7-<five-digit code>` slug reserves a namespace in the existing globally
unique `ManagedPost.slug` column. Its public path is `/p7/<code>`; all other
slugs keep their original path. No schema migration or rewrite of existing rows
is needed, and old slug routes remain available.

Numeric creation uses cryptographic random numbers and bounded retries. The
database unique constraint handles a race after the pre-check; unrelated errors
are propagated. Creation must allocate each popup variant independently while
keeping the existing transaction atomic.

Verification: numeric-link API/routing tests cover path mapping, duplicates,
collision races, retry exhaustion, existing slugs, host boundaries and drafts.
