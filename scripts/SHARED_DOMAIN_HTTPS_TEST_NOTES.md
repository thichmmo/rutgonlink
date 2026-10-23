# Shared-domain HTTPS checks

Run `node scripts/test-shared-domain-https.cjs`. It exercises the actual proxy with real NextRequest/NextResponse and the real shared-domain/site configuration. It covers each allowlisted domain, raw repeated/signed query bytes and encoded paths, leading `//` path safety, internal origin/port removal, 308 GET/HEAD/POST, edge HTTPS with internal HTTP, missing/malformed scheme metadata, localhost, unknown/custom/lookalike hosts, unchanged main aliases/auth and shared/private API restrictions after upgrade. The same redirect rule applies to Facebook and ordinary browser user agents.

Authentication is a deterministic fixture; requests use the actual log filter to avoid telemetry, and network access is rejected by the harness. No production record is read/written. These checks prove transport construction and guard preservation, not deployment-edge configuration or Facebook acceptance.
