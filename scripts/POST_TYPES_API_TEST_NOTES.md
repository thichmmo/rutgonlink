# Post type API verification

`node scripts/test-post-types-api.cjs` exercises the real GET handler with a
deterministic tenant-scoped dataset, preserving count/pagination at the database
boundary. Cases cover all/standard/Telegram, SQL/JSON null, missing enabled,
false/strict true/non-boolean values, combined search/status/domain, all supported
page sizes, empty pages, unauthenticated access and administrator isolation.

The installed Prisma query compiler is also exercised with a no-network adapter
to assert strict JSON boolean comparison, bound tenant ID, and missing-path
`JSON_EXTRACT(...) IS NULL` semantics. This is a compiler test, not a live SQL
execution; the fixture matcher does not claim to replace a database integration test.

2026-10-05 hosting-engine read-only literal probe also confirmed the same partition:
SQL NULL, JSON null, `{}`, null/false/string-true/number-one enabled values matched
standard only; boolean true matched Telegram only. The probe wrote no records.

Baseline reproduction: point `POST_TYPES_TEST_ROOT` at an untouched source copy,
then run `node scripts/test-post-types-api.cjs --baseline`; the old handler ignores
both type choices. No production records are written by this script.
