/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { Prisma, PrismaClient } = require('@prisma/client')
const root = path.resolve(process.env.POST_TYPES_TEST_ROOT || path.join(__dirname, '..'))
const baseline = process.argv.includes('--baseline')
const owner = { id: 'owner-a', isAdmin: false }
const otherOwner = { id: 'owner-b', isAdmin: true }
const states = [null, undefined, {}, { enabled: null }, { enabled: false }, { enabled: true }, { enabled: 'true' }, { enabled: 1 }]
const rows = []
for (let index = 0; index < 80; index += 1) {
  rows.push({
    id: `a-${index}`, userId: owner.id, title: index % 2 ? `Video ${index}` : `Article ${index}`,
    slug: `post-${index}`, excerpt: index % 4 ? null : 'Interesting', isPublished: index % 3 !== 0,
    telegramSettings: states[index % states.length], updatedAt: new Date(2026, 9, 1, 0, index),
    domainId: index % 3 === 2 ? 'domain-a' : null,
    sharedDomain: index % 3 === 1 ? 'share.example.test' : null,
    domain: index % 3 === 2 ? { id: 'domain-a', domain: 'custom.example.test' } : null, popup: null,
  })
}
rows.push(...rows.map(row => ({ ...row, userId: otherOwner.id, id: row.id.replace('a-', 'b-') })))
const state = { actor: owner, calls: [] }
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(filter => matches(row, filter))
    if (key === 'OR') return value.some(filter => matches(row, filter))
    if (key === 'telegramSettings') {
      assert.equal(value.path, '$.enabled')
      const flag = row.telegramSettings?.enabled
      if (value.equals === Prisma.AnyNull) return flag === null || flag === undefined
      if ('not' in value) return flag !== null && flag !== undefined && flag !== value.not
      return flag === value.equals
    }
    if (value && typeof value === 'object' && 'contains' in value) return (row[key] || '').toLowerCase().includes(value.contains.toLowerCase())
    if (key === 'domain' && value) return row.domain?.domain === value.domain
    return row[key] === value
  })
}
const prisma = {
  $transaction: async queries => Promise.all(queries),
  managedPost: {
    count: async args => { state.calls.push({ method: 'count', args }); return rows.filter(row => matches(row, args.where)).length },
    findMany: async args => {
      state.calls.push({ method: 'findMany', args })
      return rows.filter(row => matches(row, args.where)).sort((a, b) => b.updatedAt - a.updatedAt).slice(args.skip, args.skip + args.take)
    },
  },
}
const source = fs.readFileSync(path.join(root, 'app/api/posts/route.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const moduleFixture = { exports: {} }
const mocks = {
  '@/lib/content-management': { getManagedContentActor: async () => state.actor },
  '@/lib/prisma': { prisma }, '@/lib/site-config': { getSiteHostname: () => 'rutgonlink.site' },
  '@/lib/telegram-settings': {},
}
new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), moduleFixture, moduleFixture.exports)
const route = moduleFixture.exports
const tests = []
const scenario = (name, run) => tests.push({ name, run })
async function get(query = '') {
  const response = await route.GET({ nextUrl: new URL(`https://rutgonlink.site/api/posts?${query}`) })
  return { status: response.status, body: await response.json() }
}
function expected({ type = 'all', status = 'all', query = '', domain = '', page = 1, pageSize = 10 } = {}) {
  const result = rows.filter(row => row.userId === state.actor.id)
    .filter(row => type === 'all' || ((row.telegramSettings?.enabled === true) === (type === 'telegram')))
    .filter(row => status === 'all' || row.isPublished === (status === 'published'))
    .filter(row => !query || [row.title, row.slug, row.excerpt || ''].some(text => text.toLowerCase().includes(query.toLowerCase())))
    .filter(row => !domain || (row.domain?.domain || row.sharedDomain || 'rutgonlink.site') === domain)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return { ids: result.slice((page - 1) * pageSize, page * pageSize).map(row => row.id), total: result.length }
}
async function check(options = {}) {
  state.calls = []
  const result = await get(new URLSearchParams(options).toString())
  const match = expected(options)
  assert.equal(result.status, 200)
  assert.equal(result.body.total, match.total)
  assert.deepEqual(result.body.items.map(row => row.id), match.ids)
  assert.equal(state.calls.length, 2, 'filter at database, without fetching an unbounded dataset')
  const count = state.calls.find(call => call.method === 'count').args
  const list = state.calls.find(call => call.method === 'findMany').args
  assert.strictEqual(count.where, list.where, 'count and pagination must share the exact filter')
  assert.equal(list.where.userId, state.actor.id)
  assert.equal(list.take, Number(options.pageSize || 10))
  assert.equal(list.skip, (Number(options.page || 1) - 1) * list.take)
  assert.deepEqual(list.orderBy, { updatedAt: 'desc' })
  assert.deepEqual(list.include.popup.select, { id: true, name: true, isActive: true, settings: true })
  assert.deepEqual(result.body.pageSizes, [6, 10, 20, 25])
  return result
}

if (baseline) {
  for (const type of ['standard', 'telegram']) scenario(`baseline ignores ${type}`, async () => {
    const result = await get(`type=${type}`)
    assert.equal(result.body.total, expected().total)
    assert.deepEqual(result.body.items.map(row => row.id), expected().ids)
  })
} else {
  scenario('authentication rejected before any database access', async () => {
    state.actor = null; state.calls = []
    for (const type of ['all', 'standard', 'telegram']) assert.equal((await get(`type=${type}`)).status, 401)
    assert.equal(state.calls.length, 0)
    state.actor = owner
  })
  for (const type of ['all', 'standard', 'telegram']) {
    scenario(`${type}: own posts, count and pagination`, async () => {
      for (const pageSize of [6, 10, 20, 25]) for (const page of [1, 2, 20]) await check({ type, pageSize, page })
    })
    for (const status of ['all', 'published', 'draft']) scenario(`${type}: ${status}, query and domain combine`, async () => {
      for (const query of ['', 'Video', 'post-1', 'Interesting', 'missing']) {
        for (const domain of ['', 'rutgonlink.site', 'share.example.test', 'custom.example.test', 'missing.example.test']) {
          await check({ type, status, query, domain, pageSize: 6 })
        }
      }
    })
    scenario(`${type}: administrators remain scoped to own account`, async () => {
      state.actor = otherOwner
      await check({ type })
      state.actor = owner
    })
  }
  scenario('missing and unknown types preserve all-posts API compatibility', async () => {
    const normal = await get()
    for (const type of ['', 'unknown', 'Telegram', "standard' OR 1=1"]) {
      const result = await get(`type=${encodeURIComponent(type)}`)
      assert.deepEqual(result.body, normal.body)
    }
  })
  scenario('legacy NULL/missing/false settings are standard; strict true alone is Telegram', async () => {
    for (const type of ['standard', 'telegram']) {
      const result = await check({ type, pageSize: 25 })
      for (const row of result.body.items) assert.equal(row.telegramSettings?.enabled === true, type === 'telegram')
    }
    const result = await get('type=standard&pageSize=25')
    assert.equal(result.body.total, 70)
    assert(result.body.items.some(row => row.telegramSettings === null))
    assert(result.body.items.some(row => row.telegramSettings && !('enabled' in row.telegramSettings)))
  })
  scenario('public URL serialization and domain normalization remain compatible', async () => {
    const result = await get('type=standard&domain=%20SHARE.EXAMPLE.TEST%20&pageSize=25')
    assert.equal(result.body.total, expected({ type: 'standard', domain: 'share.example.test' }).total)
    for (const post of result.body.items) assert.equal(post.publicUrl, `https://share.example.test/${post.slug}`)
  })
  scenario('installed Prisma compiler preserves strict JSON booleans and missing-path NULL branch', async () => {
    const queries = []
    const adapter = { provider: 'mysql', adapterName: 'post-type-sql-probe', connect: async () => ({
      provider: 'mysql', adapterName: 'post-type-sql-probe',
      queryRaw: async query => { queries.push(query); return { columnNames: [], columnTypes: [], rows: [] } },
      executeRaw: async () => 0, dispose: async () => {}, getConnectionInfo: () => ({ supportsRelationJoins: false }),
    }) }
    const client = new PrismaClient({ adapter })
    try {
      for (const type of ['standard', 'telegram']) {
        await check({ type })
        const { where } = state.calls.find(call => call.method === 'findMany').args
        await client.managedPost.findMany({ where, select: { id: true }, take: 6, skip: 0 })
        const query = queries.at(-1)
        assert(query.sql.includes('JSON_EXTRACT'))
        assert(query.sql.includes('JSON_CONTAINS'))
        assert(query.args.includes('$.enabled'))
        assert(query.args.includes('true'), 'JSON boolean serialized as true, not string "true"')
        assert(query.args.includes(owner.id), 'tenant remains a bound parameter')
        assert(!query.sql.includes(owner.id))
        if (type === 'standard') {
          assert(/JSON_EXTRACT\([^)]*\) IS NULL/.test(query.sql), 'missing enabled path and SQL NULL must match')
          assert(query.args.includes('null'), 'JSON null enabled must match')
        } else assert(!query.sql.includes('IS NULL'))
      }
    } finally { await client.$disconnect() }
  })
}

;(async () => {
  for (const test of tests) { await test.run(); console.log(`PASS ${test.name}`) }
  console.log(baseline ? `BASELINE_OK post-types-api=${tests.length} bug=unfiltered-type` : `RESULT=PASS post-types-api=${tests.length}`)
})().catch(error => { console.error(error); process.exitCode = 1 })
