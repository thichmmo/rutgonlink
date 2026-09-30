/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')

const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const fixtureModule = { exports: {} }
  cache.set(file, fixtureModule)
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const localRequire = id => {
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id) + '.ts')
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
assert.deepEqual(popupTiming(null), { shopeeSeconds: 1, tiktokSeconds: 10, cooldownMinutes: 30 })
assert.deepEqual(popupTiming({ shopee: { delaySeconds: 9000 }, tiktok: { delaySeconds: 9000 }, cooldownMinutes: 20000 }), { shopeeSeconds: 3600, tiktokSeconds: 3600, cooldownMinutes: 10080 })
assert.equal(popupTimingLabel({ shopee: { delaySeconds: 0 }, tiktok: { delaySeconds: 0 }, cooldownMinutes: 0 }), 'S 0s · T 0s · Cooldown 0m')

global.IS_REACT_ACT_ENVIRONMENT = true
async function testPreview() {
  const { PopupTimingPreview } = load('app/dashboard/PopupTiming.tsx')
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.example' })
  const oldNow = Date.now
  let now = 100000
  Date.now = () => now
  global.window = dom.window
  global.document = dom.window.document
  const intervals = new Map()
  let id = 0
  window.setInterval = fn => { intervals.set(++id, fn); return id }
  window.clearInterval = key => intervals.delete(key)
  const root = createRoot(document.getElementById('root'))
  const timer = () => document.querySelector('[role="timer"]')
  const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.includes(text))
  const click = async text => React.act(async () => button(text).click())
  const render = async (first, second) => React.act(async () => root.render(React.createElement(PopupTimingPreview, {
    settings: { shopee: { delaySeconds: first }, tiktok: { delaySeconds: second }, cooldownMinutes: 0 },
  })))
  const tick = async ms => React.act(async () => { now += ms; for (const fn of intervals.values()) fn() })
  try {
    await render(3, 2)
    assert.equal(timer(), null)
    await click('Xem thử')
    assert.equal(timer().textContent, '3s')
    assert.equal(button('Chờ').disabled, true)
    await tick(1000)
    assert.equal(timer().textContent, '2s')
    await tick(2000)
    await click('Mô phỏng mở Shopee')
    assert.equal(timer().textContent, '2s')
    await React.act(async () => { now += 5000; document.dispatchEvent(new dom.window.Event('visibilitychange')) })
    assert.equal(timer().textContent, '0s')
    await click('Mô phỏng mở TikTok')
    assert.match(document.body.textContent, /Nội dung bài viết đã mở/)
    assert.equal(intervals.size, 0)
    await click('Chạy lại')
    assert.equal(timer().textContent, '3s')
    await render(5, 1)
    assert.equal(timer().textContent, '5s', 'Changing delays resets the demo')
    await render(0, 0)
    assert.equal(timer().textContent, '0s')
    assert.equal(button('Mô phỏng mở Shopee').disabled, false)
    await click('Ẩn xem thử')
    assert.equal(timer(), null)
    assert.equal(intervals.size, 0, 'Hiding the preview removes its timers')
    assert.equal(window.localStorage.length, 0)
    assert.equal(window.sessionStorage.length, 0)
    assert.equal(document.cookie, '')
    assert.equal(window.location.href, 'https://fixture.example/')
    await click('Xem thử')
    await React.act(async () => root.unmount())
    assert.equal(intervals.size, 0)
  } finally {
    Date.now = oldNow
    dom.window.close()
    delete global.window
    delete global.document
  }
}

testPreview().then(() => console.log('RESULT=PASS timing-normalization=6 preview-lifecycle=12')).catch(error => { console.error(error); process.exitCode = 1 })
