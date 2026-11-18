# Tranco Edge Beacon Asset (`public/t.gif`)

## Purpose
43-byte `1x1` transparent GIF served from Cloudflare Edge (`Cache-Control: public, max-age=2592000, s-maxage=2592000, immutable`, `Cross-Origin-Resource-Policy: cross-origin`) on shared/primary domains such as `honghotngay228.site` so real visitor browsers resolve DNS (`1.1.1.1` / OpenDNS) and warm Tranco Top-1M rankings with near-zero origin load.

## Behavior
- Excluded from `proxy.ts` `matcher` and telemetry logging so Passenger/MySQL never log beacon hits.
- Queried once per browser per UTC day (`?d=YYYYMMDD`) via idle `Image(1, 1)` (`referrerPolicy = "no-referrer"`).

## Verification
- `node scripts/test-shared-domain-https.cjs`
- `curl -I https://honghotngay228.site/t.gif`
