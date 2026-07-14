# Admin user detail

The detail page combines account state, plan, resources, payments and activity. All mutations require a reason; destructive actions are confirmed in a modal. Owner-only role management and API/session revocation are exposed without showing secret values.

Verification: run each action against a non-owner test user and confirm UI refresh plus audit rows.
