# Tranco Top-1M Domain Booster (`lib/tranco-boost-config.ts`)

## Purpose
Manages the Admin-configured list of domains (`AppSetting.key = "system_tranco_boost"`, defaulting to `['honghotngay228.site']` enabled out of the box) whose DNS popularity is warmed by real visitor browsers across public article/intermediate pages so they enter and remain in the global Tranco Top-1M ranking (`1.1.1.1` Cloudflare Radar + Cisco Umbrella) for `facebook.com/l.php?u=` compatibility.

## Behavior
- Never emitted for Facebook/Meta crawlers (`isFacebookCrawler`) or social bots (`isSocialBot`), keeping crawler HTML single-domain.
- Emits `<link rel="dns-prefetch">` + `<link rel="preconnect" crossorigin>` in `<head>` for immediate non-blocking DNS resolution, plus an idle `new window.Image(1, 1)` (`referrerPolicy="no-referrer"`, `?d=YYYYMMDD`) so each real device resolves DNS and hits Cloudflare's cached edge once per day without touching Web Storage, cookies, Referer headers, or cPanel origin CPU.
- Internal domains (`SHARED_DOMAINS` / `isMainAppHostname`) hit `/t.gif` (43-byte GIF cached 30d at Cloudflare Edge); external domains (such as `mesale.vn`) hit `/favicon.ico`. Self-pings (`hostname === targetDomain`) are skipped automatically.

## Verification
- `node scripts/test-numeric-post-links.cjs`
- `node scripts/test-popup-runtime.cjs`
- `node scripts/test-telegram-render.cjs`
