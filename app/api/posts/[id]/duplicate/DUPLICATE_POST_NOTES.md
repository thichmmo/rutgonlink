# Duplicate Post API (`app/api/posts/[id]/duplicate/route.ts`)

## Purpose
Duplicates an authenticated user's `ManagedPost` as an unpublished draft while preserving its popup, domain, content, and `telegramSettings` snapshot.

## Behavior
- Allocates a fresh `p7-<code>` numeric slug when duplicating a numeric `/p7/` post (retrying unique collisions via `retryNumericPostCreation`), or appends `-copy` for legacy slugged posts.
- When duplicating a numeric post whose source title was auto-generated (`Video Telegram`, `Ưu đãi hôm nay`, or an existing 5-digit code), names the duplicate after its newly allocated 5-digit code (`37325`) instead of `<old> - bản sao`; custom titles retain `<title> - bản sao`.

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `node scripts/test-telegram-api.cjs`
