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
  tasks.push({ name, fn })
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
const eventIds = new Set()
let mockPost = () => ({ userId: 'user-1', popupId: 'popup-1', popup: { id: 'popup-1', userId: 'user-1', settings: {}, firstUrl: 'https://shopee.vn', secondUrl: 'https://tiktok.com' } })
let mockClickedPopup = () => null
let failForeignKeyOnce = false
const { Prisma } = require('@prisma/client')
const route = load('app/api/popup-clicks/route.ts', {
  '@/lib/prisma': { prisma: {
    managedPost: { findFirst: async () => mockPost() },
    popupTemplate: { findFirst: async args => mockClickedPopup(args) },
    popupClick: { create: async args => {
      if (eventIds.has(args.data.eventId)) throw new Prisma.PrismaClientKnownRequestError('Duplicate', { code: 'P2002', clientVersion: 'test' })
      if (failForeignKeyOnce && args.data.popupId) {
        failForeignKeyOnce = false
        throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' })
      }
      eventIds.add(args.data.eventId)
      created.push(args)
      return args.data
    } },
  } },
  '@/lib/bot-detect': { isBot: ua => /bot/i.test(ua) },
  '@/lib/rate-limit': { checkRateLimit: () => true, getClientIp: () => '127.0.0.1' },
  '@/lib/popup-click-token': tokens,
  '@/lib/popup-settings': { defaultPopupSettings: () => ({}), normalizePopupSettings: () => ({}), popupAppliesToDevice: (_settings, ua) => /iphone|android/i.test(ua) },
  'next/server': { NextResponse: class { constructor(_body, init = {}) { this.status = init.status || 200; this.headers = init.headers || {}; } static json(body, init = {}) { const response = new this(JSON.stringify(body), init); response.json = async () => body; return response } } },
})

function request(body, headers = {}) {
  const values = new Map([
    ['user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'],
    ['host', 'share.example'],
    ['content-length', String(Buffer.byteLength(JSON.stringify(body)))],
    ...Object.entries(headers),
  ])
  return { headers: { get: key => values.get(key) }, nextUrl: { host: 'share.example' }, text: async () => JSON.stringify(body) }
}

function click(eventId = 'event-1234567890') {
  return { postId: 'post-1', popupId: 'popup-1', eventId, platform: 'SHOPEE', token: tokens.createPopupClickToken('post-1', 'popup-1', 'share.example') }
}

scenario('API accepts one valid click and stores platform identity', async () => {
  const response = await route.POST(request(click()))
  assert.equal(response.status, 204)
  assert.equal(created[0].data.platform, 'SHOPEE')
  assert.equal(created[0].data.postId, 'post-1')
  assert.equal(created[0].data.popupId, 'popup-1')
  assert.equal(created[0].data.userId, 'user-1')
})

scenario('API retries reuse an event ID without double counting', async () => {
  const before = created.length
  const body = click('event-idempotent-1234')
  assert.equal((await route.POST(request(body))).status, 204)
  assert.equal((await route.POST(request(body))).status, 204)
  assert.equal(created.length - before, 1)
})

scenario('API rejects tampered tokens and cross-origin requests', async () => {
  const before = created.length
  assert.equal((await route.POST(request({ ...click(), token: 'invalid.token' }))).status, 403)
  assert.equal((await route.POST(request(click(), { origin: 'https://other.example' }))).status, 403)
  assert.equal((await route.POST(request({ ...click(), postId: 'another-post' }))).status, 403)
  assert.equal(created.length, before)
})

scenario('API ignores desktop and bot visits', async () => {
  const before = created.length
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0)', 'ExampleBot/1.0']) {
    assert.equal((await route.POST(request(click(), { 'user-agent': ua }))).status, 204)
  }
  assert.equal(created.length, before)
})

scenario('API rejects malformed platform and oversized events', async () => {
  const before = created.length
  assert.equal((await route.POST(request({ ...click(), platform: 'UNKNOWN' }))).status, 400)
  assert.equal((await route.POST(request(click(), { 'content-length': '5000' }))).status, 413)
  assert.equal(created.length, before)
})

scenario('API retains valid in-flight clicks across popup swap, deactivation, deletion, and concurrent FK delete race', async () => {
  const defaultPost = mockPost
  try {
    // 1. Post swapped from popup-1 -> popup-2 while visitor still holds signed popup-1 token (even if popup-1 is now inactive)
    mockPost = () => ({ userId: 'user-1', popupId: 'popup-2', popup: { id: 'popup-2', userId: 'user-1', settings: {}, firstUrl: 'https://shopee.vn/new', secondUrl: 'https://tiktok.com/new' } })
    mockClickedPopup = ({ where }) => where.id === 'popup-1' && where.userId === 'user-1'
      ? { id: 'popup-1', userId: 'user-1', settings: {}, firstUrl: 'https://shopee.vn/old', secondUrl: 'https://tiktok.com/old' }
      : null
    const swappedRes = await route.POST(request({ ...click('event-after-swap-shopee-1'), platform: 'SHOPEE' }))
    assert.equal(swappedRes.status, 204)
    assert.equal(created.at(-1).data.postId, 'post-1')
    assert.equal(created.at(-1).data.popupId, 'popup-1')
    assert.equal(created.at(-1).data.userId, 'user-1')

    // 2. Old popup-1 deleted right after swapping -> click still recorded with popupId: null so post/user totals lose zero clicks
    mockClickedPopup = () => null
    const deletedRes = await route.POST(request({ ...click('event-after-delete-tiktok-1'), platform: 'TIKTOK' }))
    assert.equal(deletedRes.status, 204)
    assert.equal(created.at(-1).data.postId, 'post-1')
    assert.equal(created.at(-1).data.popupId, null)
    assert.equal(created.at(-1).data.platform, 'TIKTOK')

    // 3. Concurrent delete racing between popupTemplate lookup and popupClick.create (P2003) retries cleanly with popupId: null
    mockClickedPopup = () => ({ id: 'popup-1', userId: 'user-1', settings: {}, firstUrl: 'https://shopee.vn/old', secondUrl: 'https://tiktok.com/old' })
    failForeignKeyOnce = true
    const racedRes = await route.POST(request({ ...click('event-concurrent-delete-race-1'), platform: 'TIKTOK' }))
    assert.equal(racedRes.status, 204)
    assert.equal(created.at(-1).data.popupId, null)
  } finally {
    mockPost = defaultPost
    mockClickedPopup = () => null
    failForeignKeyOnce = false
  }
})

scenario('schema and migration preserve historical PopupClick rows with ON DELETE SET NULL', async () => {
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
  const popupClickModel = schema.slice(schema.indexOf('model PopupClick {'), schema.indexOf('}', schema.indexOf('model PopupClick {')))
  assert.match(popupClickModel, /postId\s+String\?/)
  assert.match(popupClickModel, /popupId\s+String\?/)
  assert.match(popupClickModel, /post\s+ManagedPost\?\s+@relation\(fields: \[postId\], references: \[id\], onDelete: SetNull\)/)
  assert.match(popupClickModel, /popup\s+PopupTemplate\?\s+@relation\(fields: \[popupId\], references: \[id\], onDelete: SetNull\)/)
  const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20261122000000_preserve_popup_clicks_on_delete/migration.sql'), 'utf8')
  assert.match(migration, /ON DELETE SET NULL/)
})

scenario('client beacon fallback retains one event ID and never blocks navigation', async () => {
  const sender = load('lib/popup-click-client.ts')
  const originalWindow = global.window
  const queued = [], sent = []
  try {
    global.window = { crypto: { randomUUID: () => 'event-123456789012' }, navigator: { sendBeacon: (url, body) => { queued.push({ url, body }); return false } }, fetch: (url, options) => { sent.push({ url, options }); return Promise.resolve() } }
    sender.sendPopupClick({ postId: 'post-1', popupId: 'popup-1', token: 'signed' }, 'TikTok')
    assert.equal(sent.length, 1)
    assert.equal(queued[0].body, sent[0].options.body)
    assert.equal(JSON.parse(sent[0].options.body).platform, 'TIKTOK')
    assert.equal(sent[0].options.keepalive, true)
    global.window.navigator.sendBeacon = () => true
    sender.sendPopupClick({ postId: 'post-1', popupId: 'popup-1', token: 'signed' }, 'Shopee')
    assert.equal(sent.length, 1, 'Queued beacons do not also send a fetch')
    global.window.navigator.sendBeacon = () => { throw new Error('Beacon unavailable') }
    global.window.fetch = () => Promise.reject(new Error('Offline'))
    assert.doesNotThrow(() => sender.sendPopupClick({ postId: 'post-1', popupId: 'popup-1', token: 'signed' }, 'Shopee'))
    await Promise.resolve()
  } finally { global.window = originalWindow }
})

scenario('dashboard detail link reaches the section on the overview page', async () => {
  assert.match(fs.readFileSync(path.join(root, 'app/dashboard/PopupClickStats.tsx'), 'utf8'), /href="\/dashboard#popup-click-analytics"/)
  assert.match(fs.readFileSync(path.join(root, 'app/dashboard/page.tsx'), 'utf8'), /<PopupAnalytics\s*\/>/)
  assert.match(fs.readFileSync(path.join(root, 'app/dashboard/PopupAnalytics.tsx'), 'utf8'), /id="popup-click-analytics"/)
})

scenario('stats API scopes totals and both groups to the authenticated account', async () => {
  let userId = null
  const queries = []
  const api = load('app/api/popup-stats/route.ts', {
    '@/lib/content-management': { getManagedContentUserId: async () => userId },
    '@/lib/popup-analytics-server': Object.fromEntries(['getPopupClickCounts', 'getPopupClickList', 'getPopupClickTotals'].map(name => [name, async (...args) => { queries.push({ name, args }); return {} }])),
  })
  const req = query => ({ nextUrl: new URL('https://fixture.example/api/popup-stats' + query) })
  assert.equal((await api.GET(req(''))).status, 401)
  assert.equal(queries.length, 0)
  userId = 'tenant-A'
  assert.equal((await api.GET(req(''))).status, 200)
  assert.equal(queries.length, 3)
  assert.ok(queries.every(query => query.args[0] === 'tenant-A'))
  assert.deepEqual(queries.filter(query => query.name === 'getPopupClickList').map(query => query.args[1]), ['post', 'popup'])
  queries.length = 0
  const response = await api.GET(req('?group=post&ids=post1,post1,post2'))
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(queries.find(query => query.name === 'getPopupClickCounts').args.slice(0, 3), ['tenant-A', 'post', ['post1', 'post2']])
  assert.equal((await api.GET(req('?group=unknown'))).status, 400)
  assert.equal((await api.GET(req('?group=post&ids=' + Array.from({ length: 51 }, (_, i) => 'post' + i).join(',')))).status, 400)
})

async function main() {
  // Sequential execution isolates window/network fixtures and event-store assertions.
  for (const { name, fn } of tasks) { await fn(); passed++; console.log(`PASS ${name}`) }
  console.log(`RESULT=PASS popup-click-scenarios=${passed}`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
