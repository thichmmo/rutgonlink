# iPhone Facebook popup regression

The shared popup step resolver now derives TikTok product OneLinks only for
iPhone/Facebook, preserving the original affiliate payload. Both public runtimes
keep committed progress when storage disappears, independently persist local and
cookie handoffs (including completion, with a 30-minute TTL), and resume countdowns
from a wall-clock deadline. Shopee URL selection/navigation remains unchanged.

`jsdom` is a pinned development dependency for `node scripts/test-popup-runtime.cjs`.
The test executes the actual generated inline script and React component; baseline
mode reproduces the old storage-denied replay. Verify with the regression command,
focused ESLint, TypeScript and `pnpm build` using the CI placeholder environment.
Actual Facebook/iOS universal-link routing and its native confirmation require a
physical-device test; local tests mock external navigation.
