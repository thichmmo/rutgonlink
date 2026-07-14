# FB Debug Handoff - 2026-05-13

## Request

- API key tested: `ls_live_REDACTED`
- Manual scrape URL: `https://phimngay.site/xem-tron-phim`
- Commits checked:
  - `6640daa` - Apply click threshold to Facebook debug now
  - `8474e14` - Let daily Facebook debug ignore click threshold

## Commit Check

Both `6640daa` and `8474e14` use the same Facebook scrape implementation in `lib/runtime-config.ts`:

- Graph endpoint: `https://graph.facebook.com/v21.0/`
- Preload request: `GET ?id=<URL>&access_token=<TOKEN>`
- Scrape request: `POST` form body with:
  - `id=<URL>`
  - `scrape=true`
  - `access_token=<TOKEN>`

This is also the same mechanism from commit `977cee8` (`Send Facebook scrape as form post`).

## Token Check

The account for this API key has 2 stored Facebook tokens.

Both tokens were tested with the manual scrape URL. Both tokens returned:

- HTTP: `400`
- Facebook error code: `368`
- Type: `OAuthException`
- Message: `The action attempted has been deemed abusive or is otherwise disallowed`

## Endpoint Variants Tested

Using the first stored token:

| Mode | Result |
| --- | --- |
| `6640daa/8474e14/977cee8`: `v21.0 POST` form | Failed `368` |
| `f411c68` style: `v21.0 GET scrape` | Failed `368` |
| Legacy unversioned `GET scrape` | Failed `100` |
| Legacy unversioned `POST` form | Failed `368` |
| `v20.0 GET scrape` | Failed `368` |
| `v20.0 POST` form | Failed `368` |

## Production Manual API Test

Endpoint:

```bash
PATCH https://rutgonlink.site/api/v1/fb-debug
Authorization: Bearer ls_live_REDACTED
Content-Type: application/json

{
  "action": "scrape",
  "url": "https://phimngay.site/xem-tron-phim"
}
```

Response summary:

```json
{
  "ok": false,
  "message": "The action attempted has been deemed abusive or is otherwise disallowed",
  "errorCode": 368,
  "errorType": "OAuthException",
  "usedToken": true
}
```

## Follow-up Fix

Further testing showed the important behavior:

- A first Graph scrape for `https://phimngay.site/xem-tron-phim` did return `200 OK`.
- The response contained the Shopee preview title/image.
- Calling scrape again immediately for the same URL caused Facebook error `368`.

So the practical bug was repeated re-scrape calls too close together for the same URL. Facebook Sharing Debugger UI can show the recent successful scrape, but the app was still calling Graph again and creating a fresh `368`.

## Code Change

Commit pushed:

- `533ffff` - `Avoid repeated Facebook scrape abuse errors`
- `4981a9e` - `Use POST-only Facebook scrape retry`
- `edc4efa` - `Try all Facebook scrape tokens manually`

Implemented:

- `FB_DEBUG_URL_COOLDOWN_MINUTES = 10`
- Manual scrape now detects short links by URL.
- Manual scrape uses POST-only form request, matching the working standalone Node script.
- Manual scrape retries transient/368 failures up to 5 attempts per token with a 3-second delay.
- Manual scrape tries every live token for the user until one succeeds.
- Batch/job debug also skips recently scraped links to avoid causing `368`.
- Successful manual scrape updates `lastFbDebug` for the matching short link.

## Production Verification

Tested endpoint:

```bash
PATCH https://rutgonlink.site/api/v1/fb-debug
Authorization: Bearer ls_live_REDACTED
Content-Type: application/json

{
  "action": "scrape",
  "url": "https://phimngay.site/xem-tron-phim"
}
```

Production response:

```json
{
  "ok": true,
  "usedToken": true,
  "errorCode": null,
  "title": "Shopee preview title returned",
  "image": "Shopee preview image returned"
}
```

Final production tests:

| URL | Result |
| --- | --- |
| `https://phimngay.site/xem-them-phan-tiep1` | `ok: true`, title/image returned |
| `https://phimngay.site/xem-tron-phim` | `ok: true`, title/image returned |

This is now a real Graph scrape success, not a skipped/cached response.
