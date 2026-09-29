/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const fixtureModule = { exports: {} }
  cache.set(file, fixtureModule)
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const localRequire = id => {
    if (id === '@/lib/popup-settings') return load('lib/popup-settings.ts')
    if (id === '@/lib/popup-link') return load('lib/popup-link.ts')
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixtureModule, fixtureModule.exports)
  return fixtureModule.exports
}
const { popupTiming, popupTimingLabel } = load('app/dashboard/popup-timing.ts')

assert.deepEqual(popupTiming({ shopee: { delaySeconds: 1.4 }, tiktok: { delaySeconds: '10' }, cooldownMinutes: 30 }), {
  shopeeSeconds: 1,
  tiktokSeconds: 10,
  cooldownMinutes: 30,
})
assert.deepEqual(popupTiming({ shopee: { delaySeconds: -2 }, tiktok: { delaySeconds: 'not-a-number' }, cooldownMinutes: 0 }), {
  shopeeSeconds: 0,
  tiktokSeconds: 10,
  cooldownMinutes: 0,
})
assert.equal(popupTimingLabel(undefined), 'S 1s · T 10s · Cooldown 30m')
console.log('RESULT=PASS popup-timing-cases=3')
