/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const fixtureModule = { exports: {} }
  new Function('require', 'module', 'exports', code)(
    id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), fixtureModule, fixtureModule.exports,
  )
  return fixtureModule.exports
}

const analytics = load('lib/popup-analytics.ts')
const scenarios = []
function scenario(name, fn) { scenarios.push({ name, fn }) }
const zero = { shopee: 0, tiktok: 0, total: 0 }
const json = (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
const next = { NextResponse: { json } }

function aggregateFixture(events = []) {
  const queries = []
  const prisma = { popupClick: { groupBy: async args => {
    queries.push(args)
    const groups = new Map()
    for (const event of events) {
      if (!args.where.userId.in.includes(event.userId) || !args.where.platform.in.includes(event.platform)) continue
      if (event.createdAt < args.where.createdAt.gte || event.createdAt > args.where.createdAt.lte) continue
      const key = `${event.userId}:${event.platform}`
      const group = groups.get(key) || { userId: event.userId, platform: event.platform, _count: { _all: 0 } }
      group._count._all++
      groups.set(key, group)
    }
    return [...groups.values()]
  } } }
  const helper = load('lib/admin-popup-clicks.ts', { '@/lib/prisma': { prisma }, '@/lib/popup-analytics': analytics })
  return { helper, queries, prisma }
}

function event(userId, platform, date) { return { userId, platform, createdAt: new Date(date) } }

scenario('Vietnam midnight is inclusive; yesterday and future events are excluded', async () => {
  const now = new Date('2026-10-07T16:59:59.999Z')
  const fixture = aggregateFixture([
    event('a', 'SHOPEE', '2026-10-06T16:59:59.999Z'),
    event('a', 'SHOPEE', '2026-10-06T17:00:00.000Z'),
    event('a', 'TIKTOK', now),
    event('a', 'TIKTOK', '2026-10-07T17:00:00.000Z'),
  ])
  assert.deepEqual((await fixture.helper.getAdminUserPopupClicksToday(['a'], now)).a, { shopee: 1, tiktok: 1, total: 2 })
  assert.equal(fixture.queries[0].where.createdAt.gte.toISOString(), '2026-10-06T17:00:00.000Z')
  assert.equal(fixture.queries[0].where.createdAt.lte, now)
  assert.deepEqual((await fixture.helper.getAdminUserPopupClicksToday(['a'], new Date('2026-10-07T17:00:00.000Z'))).a, { shopee: 0, tiktok: 1, total: 1 })
})

scenario('Vietnam date window is independent of server timezone', async () => {
  const original = process.env.TZ
  try {
    for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Ho_Chi_Minh']) {
      process.env.TZ = timezone
      const fixture = aggregateFixture([event('a', 'TIKTOK', '2026-12-31T17:00:00.000Z')])
      const result = await fixture.helper.getAdminUserPopupClicksToday(['a'], new Date('2026-12-31T17:01:00.000Z'))
      assert.deepEqual(result.a, { shopee: 0, tiktok: 1, total: 1 })
      assert.equal(fixture.queries[0].where.createdAt.gte.toISOString(), '2026-12-31T17:00:00.000Z')
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
})

scenario('selected users receive separate platform totals and explicit zeros', async () => {
  const now = new Date('2026-10-07T05:00:00.000Z')
  const fixture = aggregateFixture([
    event('a', 'SHOPEE', now), event('a', 'SHOPEE', now), event('a', 'TIKTOK', now),
    event('b', 'TIKTOK', now), event('outside', 'SHOPEE', now), event('a', 'UNKNOWN', now),
  ])
  const result = await fixture.helper.getAdminUserPopupClicksToday(['a', 'b', 'c', 'a'], now)
  assert.deepEqual(result, { a: { shopee: 2, tiktok: 1, total: 3 }, b: { shopee: 0, tiktok: 1, total: 1 }, c: zero })
  assert.deepEqual(fixture.queries[0].where.userId.in, ['a', 'b', 'c'])
  assert.equal(fixture.queries.length, 1)
  assert.equal('post' in fixture.queries[0].where, false, 'Accepted historical events do not require an active post')
})

scenario('empty selection performs no aggregate query', async () => {
  const fixture = aggregateFixture()
  assert.deepEqual(await fixture.helper.getAdminUserPopupClicksToday([], new Date()), {})
  assert.equal(fixture.queries.length, 0)
})

function user(id) {
  return { id, numericId: id === 'a' ? 1 : 2, email: `${id}@fixture.example`, name: id, password: 'fixture-hash',
    status: 'active', adminRole: null, plan: 'free', createdAt: new Date(),
    _count: { links: 1, domains: 0, payments: 0 } }
}

function apiFixture({ users = [user('a'), user('b')], allowed = true, exists = true, events = [] } = {}) {
  const fixture = aggregateFixture(events)
  const calls = [], permissions = []
  const record = (name, result) => async args => { calls.push({ name, args }); return result }
  const detailUser = { ...user('a'), apiKey: 'fixture-key', _count: { links: 1, domains: 0, notes: 0, ownedWorkspaces: 0, payments: 0 } }
  delete detailUser.password
  const prisma = {
    ...fixture.prisma,
    user: {
      findMany: record('user.findMany', users), count: record('user.count', 40), groupBy: record('user.groupBy', []),
      findUnique: record('user.findUnique', exists ? detailUser : null),
    },
    link: { findMany: record('link.findMany', users.map(item => ({ userId: item.id, _count: { clicks: item.id === 'a' ? 900 : 700 } }))) },
    ...Object.fromEntries(['domain', 'payment', 'subscription', 'workspace', 'requestLog'].map(name => [name, { findMany: record(`${name}.findMany`, []) }])),
  }
  const mocks = {
    'next/server': next,
    '@/lib/prisma': { prisma },
    '@/lib/admin-popup-clicks': fixture.helper,
    '@/lib/admin-auth': {
      ADMIN_ROLES: ['owner', 'support', 'finance', 'ops', 'viewer'], hasAdminPermission: () => false,
      requireAdmin: async permission => {
        permissions.push(permission)
        return allowed ? { ok: true, admin: { role: 'viewer', permissions: ['users.read'] } } : { ok: false, response: json({ error: 'Forbidden' }, { status: 403 }) }
      },
    },
    '@/lib/admin-audit': { recordAdminAudit: async () => assert.fail('GET must not write audit') },
    '@/lib/billing': { computePlanEndDate: () => assert.fail('GET must not mutate plans') },
  }
  return { ...fixture, calls, permissions, list: load('app/api/admin/users/route.ts', mocks), detail: load('app/api/admin/users/[id]/route.ts', mocks) }
}

const req = query => ({ nextUrl: new URL('https://fixture.example/api/admin/users' + query) })
const params = id => ({ params: Promise.resolve({ id }) })

scenario('both admin read APIs reject before user or aggregate database reads', async () => {
  const fixture = apiFixture({ allowed: false })
  assert.equal((await fixture.list.GET(req(''))).status, 403)
  assert.equal((await fixture.detail.GET(req(''), params('a'))).status, 403)
  assert.deepEqual(fixture.permissions, ['users.read', 'users.read'])
  assert.equal(fixture.calls.length + fixture.queries.length, 0)
})

scenario('list preserves lifetime Link counts and only aggregates current-page users', async () => {
  const now = new Date()
  const fixture = apiFixture({ events: [event('a', 'SHOPEE', now), event('a', 'TIKTOK', now), event('outside', 'SHOPEE', now)] })
  const response = await fixture.list.GET(req('?page=2'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  const result = await response.json()
  assert.deepEqual(result.users[0].popupClicksToday, { shopee: 1, tiktok: 1, total: 2 })
  assert.deepEqual(result.users[1].popupClicksToday, zero)
  assert.equal(result.users[0].clickCount, 900)
  assert.equal(result.users[1].clickCount, 700)
  assert.equal(result.users[0].linkCount, 1)
  assert.equal('password' in result.users[0], false)
  assert.equal(result.popupClicksTimezone, 'Asia/Ho_Chi_Minh')
  assert.equal(fixture.queries[0].where.createdAt.lte.toISOString(), result.popupClicksTodayAsOf)
  assert.deepEqual(fixture.queries[0].where.userId.in, ['a', 'b'])
  const listing = fixture.calls.find(call => call.name === 'user.findMany').args
  assert.equal(listing.skip, 20)
  assert.equal(listing.take, 20)
  assert.equal(result.page, 2)
  assert.equal(result.pages, 2)
})

scenario('empty list retains pagination metadata without reading popup events', async () => {
  const fixture = apiFixture({ users: [] })
  const result = await (await fixture.list.GET(req(''))).json()
  assert.deepEqual(result.users, [])
  assert.equal(result.total, 40)
  assert.equal(fixture.queries.length, 0)
  assert.ok(result.popupClicksTodayAsOf)
})

scenario('detail uses one target user and does not expose API credentials', async () => {
  const now = new Date()
  const fixture = apiFixture({ events: [event('a', 'TIKTOK', now), event('a', 'TIKTOK', now), event('b', 'SHOPEE', now)] })
  const response = await fixture.detail.GET(req(''), params('a'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  const result = await response.json()
  assert.deepEqual(result.user.popupClicksToday, { shopee: 0, tiktok: 2, total: 2 })
  assert.equal('apiKey' in result.user, false)
  assert.equal(result.user.hasApiKey, true)
  assert.equal(result.links[0]._count.clicks, 900)
  assert.equal(result.popupClicksTimezone, 'Asia/Ho_Chi_Minh')
  assert.deepEqual(fixture.queries[0].where.userId.in, ['a'])
  assert.equal(fixture.queries[0].where.createdAt.lte.toISOString(), result.popupClicksTodayAsOf)
})

scenario('detail returns zero counts for a user without popup events', async () => {
  const fixture = apiFixture()
  const result = await (await fixture.detail.GET(req(''), params('a'))).json()
  assert.deepEqual(result.user.popupClicksToday, zero)
})

scenario('missing detail is 404 before aggregate or related resource reads', async () => {
  const fixture = apiFixture({ exists: false })
  const response = await fixture.detail.GET(req(''), params('missing'))
  assert.equal(response.status, 404)
  assert.equal(fixture.queries.length, 0)
  assert.deepEqual(fixture.calls.map(call => call.name), ['user.findUnique'])
})

scenario('all existing users.read admin roles retain access; ordinary and suspended accounts do not', async () => {
  let account = null
  const auth = load('lib/admin-auth.ts', {
    'next/server': next,
    'next-auth': { getServerSession: async () => ({ user: { email: 'admin@fixture.example' } }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => account } } },
  })
  for (const role of ['owner', 'support', 'finance', 'ops', 'viewer']) {
    account = { id: 'admin', email: 'admin@fixture.example', status: 'active', adminRole: role }
    assert.equal((await auth.requireAdmin('users.read')).ok, true)
  }
  account = { id: 'ordinary', email: 'ordinary@fixture.example', status: 'active', adminRole: null }
  assert.equal((await auth.requireAdmin('users.read')).ok, false)
  account = { id: 'admin', email: 'admin@fixture.example', status: 'suspended', adminRole: 'owner' }
  assert.equal((await auth.requireAdmin('users.read')).ok, false)
})

async function main() {
  for (const { name, fn } of scenarios) { await fn(); console.log(`PASS ${name}`) }
  console.log(`RESULT=PASS admin-popup-click-scenarios=${scenarios.length}`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
