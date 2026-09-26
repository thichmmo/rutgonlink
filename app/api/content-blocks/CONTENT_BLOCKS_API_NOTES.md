# Fixed content API

`/api/content-blocks` manages account-owned reusable article blocks. Blocks support before/after placement, ordering, active state and rich/plain/raw formats; raw source requires an admin actor. `/reorder` updates order only for owned records.

Verify with `pnpm exec eslint app/api/content-blocks` and create/update/delete/reorder smoke tests.
