# Admin domains UI

The `/admin/domains` screen provides a top-level system card to configure the global default domain pre-selected for all members when creating new posts (`GET/PUT /api/admin/domains/default-post-domain`, defaulting to `ca33newss.xyz`), alongside the custom-domain moderation table combining ownership, verification, moderation and link usage. Re-enable clearly warns that DNS verification is not restored automatically.

Verification: save the default post domain, confirm `/api/posts/options` reflects it across all post creation modes, and exercise custom-domain search/filter/moderation with audit checks.
