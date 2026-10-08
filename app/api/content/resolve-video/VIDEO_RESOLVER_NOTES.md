# Article video API

`POST /api/content/resolve-video` accepts `{url}` and returns `{url,kind:'video'}` for the first validated direct video in static article HTML. Authentication uses `getManagedContentUserId` before JSON parsing, DNS or external requests. The route performs no database/content writes. Invalid input returns 400, unauthenticated access 401, unsupported/no direct video or unsafe sources 422, upstream failures 502, and the shared deadline 504. Responses contain concise Vietnamese errors without fetched HTML, credential values or upstream URLs.

Verify: `node scripts/test-article-video.cjs` (64 deterministic parser/API/DNS/socket/stream scenarios) and scoped ESLint. The dashboard keeps direct media insertion synchronous; article resolution happens before insertion and keeps the selected source query intact.
