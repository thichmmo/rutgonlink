# Post API

Posts are private to their owner in the management API. Creation validates slug uniqueness and verifies the selected popup belongs to the same account.

Verify with `npx eslint app/api/posts` and a duplicate-slug request.
