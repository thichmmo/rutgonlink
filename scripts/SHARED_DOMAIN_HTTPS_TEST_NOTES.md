# Shared-domain HTTPS checks

Run `node scripts/test-shared-domain-https.cjs`. It exercises the actual proxy with real NextRequest/NextResponse and the real shared-domain/site configuration. It covers each allowlisted domain, query bytes and encoded paths **as received by the proxy**, leading `//` path safety, internal origin/port removal, `301` on `GET`/`HEAD` (with no `Refresh` header), method-preserving `308` on `POST`, `/robots.txt` and `/.well-known/acme-challenge/*` passthrough on same-host HTTP, edge HTTPS with internal HTTP, missing/malformed scheme metadata, localhost, unknown/custom/lookalike hosts, unchanged main aliases/auth, and shared/private API restrictions after upgrade. It also verifies that `facebookexternalhit`, `Facebot`, `meta-externalagent`, and `WhatsApp` never trigger telemetry fetches even when `LOG_SECRET` is set, while ordinary browser telemetry targets `https://rutgonlink.site/api/internal/log`.

A separate case passes an external query through the installed Next parsed-query reconstruction helpers and `stripInternalSearchParams`, as used before the proxy. It explicitly observes percent/space normalization, then verifies every decoded query value, per-key repeated-value order, empty values and a fully nested signed affiliate URL survive the HTTPS redirect. Verified custom-domain `301` upgrades in the route handler are covered by `node scripts/test-numeric-post-links.cjs`.

Authentication is a deterministic fixture; network access is rejected by default in the harness and no production record is read/written.

## Google redirect checks (2026-11-18)

- Scenarios also verify `302` redirects (`Location: https://mesale.vn/`) for Google `Referer`, `Googlebot`, and `GSA/` Google App requests across shared/custom short-link paths and `/p/*`, `/share/*`, `/bio/*` on `rutgonlink.site`, while confirming `/`, `/pricing`, `/login`, and `/robots.txt` remain untouched (`18` total scenarios).
