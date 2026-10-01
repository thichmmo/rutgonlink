# Public post inspection guard

`public-post-guard.ts` shares one self-contained installer between the standalone
HTML route and the React alias. It checks on entry, resize, page/visibility return
and a one-second interval. A persistent desktop panel gap (120 ms confirmation)
or a mobile UA paired with a desktop platform redirects once to Mesale. Capture
listeners block clicks while a detected panel is pending, so popup tracking and
affiliate navigation do not race the redirect. F12 and right-click still redirect.

Real mobile platform hints and multi-touch iPads bypass the desktop heuristic.
Proportional zoom, invalid dimensions and transient resize are ignored. No browser
API reliably identifies DevTools: undocked tools, spoofed hints or disabled scripts
can defeat detection; large browser sidebars can resemble a docked panel. This is
a navigation deterrent, not protection for HTML/JavaScript already delivered.

The shared noscript markup hides article/popup UI and uses an HTML meta refresh
to Mesale, with a manual link if refresh is disabled. It is emitted only on public
managed posts, never on dashboards or ordinary shortened links. OG metadata stays
in the response. No persistent visitor bans, telemetry or debugger loops are added.

Verify: `node scripts/test-popup-runtime.cjs` (both renderers, no-JS SSR, device
hints, timing/cleanup, click tracking and mobile handoff regressions), scoped
ESLint and TypeScript. Browser checks must also exercise JavaScript disabled
before navigation; a DOM-only test does not execute meta refresh.
