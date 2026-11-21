# Telegram settings

`telegram-settings.ts` is shared by account settings, post forms, and public rendering.
The object contains `enabled`, `url`, `buttonText`, and `disclaimer`; text is plain
text (renderers must escape it). URL input accepts HTTPS `t.me` / `telegram.me`
links with a nonempty path, no credentials, nonstandard port, backslash, or embedded
whitespace. Limits are 2048 / 120 / 4000 characters for URL / button / disclaimer.

Writes use strict Zod validation. Read normalization merges missing legacy fields
with disabled defaults and fails closed for invalid records. The normalizer never
looks up account defaults: public posts use their own saved snapshot only.

Verify: `node scripts/test-telegram-api.cjs` (18 scenarios), scoped ESLint and TypeScript.


## Multi-Link Extra CTA Buttons (`extraButtons`, 2026-11-21)

- `TelegramSettings` supports up to 6 optional `extraButtons` (`{ url, buttonText, color? }`), validated via `isSafeHttpsActionUrl` (HTTPS only, public dotted hostname, no credentials/ports/whitespace/localhost).
- When `extraButtons` is empty or omitted, `telegramSettingsSchema` and `normalizeTelegramSettings` omit the key so single-button snapshots remain byte-identical.
- Verify: `node scripts/test-telegram-api.cjs` (19 scenarios).
