# System-Wide Default Post Domain (`lib/post-default-domain-config.ts`)

## Purpose
Stores and resolves the Admin-configured default domain (`AppSetting.key = "system_default_post_domain"`, defaulting to `ca33newss.xyz`) pre-selected for all members whenever they open a new post composer (`Tạo bài thường`, `Tạo Bọc thẳng`, or `Tạo bài Telegram`).

## Behavior
- Restricts global defaults to domains available to every member (`SHARED_DOMAINS` plus the primary site hostname).
- Falls back gracefully to `ca33newss.xyz` (or `SHARED_DOMAINS[0]`) when unset or if a stored domain is later removed from `SHARED_DOMAINS`.
- Members can still choose any other shared, primary, or verified custom domain inside the post composer, and editing an existing post always retains its saved domain.

## Verification
- `node scripts/test-telegram-quick-form.cjs`
- `node scripts/test-numeric-post-links.cjs`
