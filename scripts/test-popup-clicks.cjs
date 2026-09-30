/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
process.env.NEXTAUTH_SECRET = 'popup-click-test-secret'

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const fixtureModule = { exports: {} }
  const localRequire = id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id)
  new Function('require', 'module', 'exports', code)(localRequire, fixtureModule, fixtureModule.exports)
  return fixtureModule.exports
}

let passed = 0
const tasks = []
function scenario(name, fn) {
  const task = Promise.resolve().then(fn).then(() => { passed++; console.log(`PASS ${name}`) })
  tasks.push(task)
}

const tokens = load('lib/popup-click-token.ts')
const analytics = load('lib/popup-analytics.ts')

scenario('signed token validates exact post popup and host', async () => {
  const now = Date.parse('2026-09-30T05:00:00.000Z')
  const token = tokens.createPopupClickToken('post-1', 'popup-1', 'share.example', now)
  assert.equal(tokens.verifyPopupClickToken(token, 'post-1', 'popup-1', 'share.example', now + 1000), true)
  assert.equal(tokens.verifyPopupClickToken(token, 'post-2', 'popup-1', 'share.example', now + 1000), false)
  assert.equal(tokens.verifyPopupClickToken(token, 'post-1', 'popup-1', 'other.example', now + 1000), false)
})

scenario('signed token expires', async () => {
  const now = Date.parse('2026-09-30T05:00:00.000Z')
  const token = tokens.createPopupClickToken('post-1', 'popup-1', 'share.example', now)
  assert.equal(tokens.verifyPopupClickToken(token, 'post-1', 'popup-1', 'share.example', now + 86400000), false)
})

scenario('Vietnam windows use local midnight', async () => {
  const windows = analytics.popupClickWindows(new Date('2026-09-30T02:30:00.000Z'))
  assert.equal(windows.today.toISOString(), '2026-09-29T17:00:00.000Z')
  assert.equal(windows.yesterday.toISOString(), '2026-09-28T17:00:00.000Z')
  assert.equal(windows.dayBefore.toISOString(), '2026-09-27T17:00:00.000Z')
})

scenario('platform rows expose totals for every window', async () => {
  const result = analytics.popupClickStats({ todayShopee: 3, todayTiktok: 3, yesterdayShopee: 2, yesterdayTiktok: 1 })
  assert.deepEqual(result.today, { shopee: 3, tiktok: 3, total: 6 })
  assert.deepEqual(result.yesterday, { shopee: 2, tiktok: 1, total: 3 })
})

scenario('client sender queues beacon and keepalive fallback', async () => {
  const source = fs.readFileSync(path.join(root, 'lib/popup-click-client.ts'), 'utf8')
  assert.match(source, /sendBeacon/)
  assert.match(source, /keepalive: true/)
  assert.match(source, /platform\.toUpperCase/)
})

scenario('public routes embed tracking payload', async () => {
  const route = fs.readFileSync(path.join(root, 'app/[shortCode]/route.ts'), 'utf8')
  const react = fs.readFileSync(path.join(root, 'app/posts/[slug]/PostPopup.tsx'), 'utf8')
  assert.match(route, /createPopupClickToken/)
  assert.match(route, /recordPopupClick\(tracking, platform\.platform\)/)
  assert.match(react, /sendPopupClick\(tracking, current\.platform\)/)
})

const created = []
const route = load('app/api/popup-clicks/route.ts', {
  '@/lib/prisma': { prisma: {
    managedPost: { findFirst: async () => ({ userId: 'user-1', popup: { userId: 'user-1', settings: {}, firstUrl: 'https://shopee.vn', secondUrl: 'https://tiktok.com' } }) },
    popupClick: { create: async args => { created.push(args); return args.data } },
  } },
  '@/lib/bot-detect': { isBot: () => false },
  '@/lib/rate-limit': { checkRateLimit: () => true, getClientIp: () => '127.0.0.1' },
  '@/lib/popup-click-token': { verifyPopupClickToken: () => true },
  '@/lib/popup-settings': { normalizePopupSettings: () => ({ shopee: { enabled: true, iosEnabled: true, androidEnabled: true }, tiktok: { enabled: true, iosEnabled: true, androidEnabled: true } }), popupAppliesToDevice: () => true },
  '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
  'next/server': { NextResponse: class { constructor(_body, init = {}) { this.status = init.status || 200; this.headers = init.headers || {}; } static json(body, init = {}) { const response = new this(JSON.stringify(body), init); response.json = async () => body; return response } } },
})

function request(body) {
  const values = new Map([
    ['user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'],
    ['host', 'share.example'],
    ['content-length', String(Buffer.byteLength(JSON.stringify(body)))],
  ])
  return { headers: { get: key => values.get(key) }, nextUrl: { host: 'share.example' }, text: async () => JSON.stringify(body) }
}

scenario('API accepts one valid click and stores platform identity', async () => {
  const req = request({ postId: 'post-1', popupId: 'popup-1', eventId: 'event-1234567890', platform: 'SHOPEE', token: 'fixture' })
  req.headers = { get: key => new Map([['user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'], ['host', 'share.example'], ['content-length', '130']]).get(key) }
  const response = await route.POST(req)
  assert.equal(response.status, 204)
  assert.equal(created[0].data.platform, 'SHOPEE')
})

Promise.all(tasks).then(() => {
  console.log(`RESULT=PASS popup-click-scenarios=${passed}`)
}).catch(error => { console.error(error); process.exitCode = 1 })
