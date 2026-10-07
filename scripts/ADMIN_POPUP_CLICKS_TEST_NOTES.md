# Daily admin popup count regression test

`node scripts/test-admin-popup-clicks.cjs` exercises the real helper and read API modules against grouped fixture events. It checks inclusive Vietnam midnight/captured-now boundaries, future/other-account exclusion, zero users, batched page scope, authorization before DB reads, missing details, private caching, and unchanged lifetime Link counts. It performs no live database or network operations.
