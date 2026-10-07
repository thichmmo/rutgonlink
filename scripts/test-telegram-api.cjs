/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { Prisma } = require('@prisma/client')
const root = path.resolve(__dirname, '..')

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText
  const fixture = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    return require(id)
  }, fixture, fixture.exports)
  return fixture.exports
}

const telegram = load('lib/telegram-settings.ts')
const enabled = { ...telegram.defaultTelegramSettings(), enabled: true, url: 'https://t.me/+fixtureInvite' }
const disabled = { ...enabled, enabled: false }
const userA = { id: 'owner-a', email: 'a@example.test', isAdmin: false }
const userB = { id: 'owner-b', email: 'b@example.test', isAdmin: true }
const state = { actor: userA, calls: [], users: new Map(), posts: new Map(), nextId: 0 }
function record(name, args) { state.calls.push({ name, args }) }
function ownPost(where) {
  const post = state.posts.get(where.id)
  return post && post.userId === where.userId ? post : null
}
const prisma = {
  $transaction: async operation => typeof operation === 'function' ? operation(prisma) : Promise.all(operation),
  user: {
    findUnique: async args => { record('user.findUnique', args); return state.users.get(args.where.id) || null },
    update: async args => {
      record('user.update', args)
      assert(state.users.has(args.where.id))
      state.users.set(args.where.id, { ...state.users.get(args.where.id), ...structuredClone(args.data) })
      return state.users.get(args.where.id)
    },
  },
  managedPost: {
    findFirst: async args => { record('post.findFirst', args); return ownPost(args.where) },
    findUnique: async args => { record('post.findUnique', args); return [...state.posts.values()].find(p => p.slug === args.where.slug) || null },
    create: async args => {
      record('post.create', args)
      const post = { id: `post-${++state.nextId}`, domain: null, popup: null, ...args.data,
        telegramSettings: args.data.telegramSettings === Prisma.DbNull ? null : structuredClone(args.data.telegramSettings),
      }
      state.posts.set(post.id, post)
      return post
    },
    updateMany: async args => {
      record('post.updateMany', args)
      const post = ownPost(args.where)
      if (!post) return { count: 0 }
      Object.assign(post, structuredClone(args.data))
      return { count: 1 }
    },
  },
  popupTemplate: { findMany: async args => { record('popup.findMany', args); return [] } },
}
// Real post schema is exercised, while authentication/storage and unrelated domain helpers stay deterministic.
const schemaModule = load('lib/content-management.ts', {
  'next-auth': {}, '@/lib/auth-options': {}, '@/lib/prisma': { prisma },
  '@/lib/intermediate-image': { MAX_INTERMEDIATE_IMAGE_LENGTH: 8000000, isValidIntermediateImage: () => true },
  '@/lib/shared-domains': { SHARED_DOMAINS: [] }, '@/lib/site-config': { getSiteHostname: () => 'rutgonlink.site' },
  '@/lib/popup-settings': {}, '@/lib/video-embed': {}, '@/lib/telegram-settings': telegram,
  '@/lib/popup-affiliate-url': load('lib/popup-affiliate-url.ts'),
})
const mocks = {
  '@/lib/prisma': { prisma }, '@/lib/telegram-settings': telegram,
  '@/lib/site-config': { getSiteHostname: () => 'rutgonlink.site' },
  '@/lib/content-management': {
    postSchema: schemaModule.postSchema,
    getManagedContentActor: async () => state.actor,
    getPublicationTargets: async userId => { record('targets', userId); return [] },
    ownsActivePopups: async () => true,
    ownsPopupRecord: async () => true,
    normalizeContentFormat: value => value,
    normalizeContent: value => value,
    validatePublicationTarget: async () => ({ domainId: null, sharedDomain: null }),
  },
}
const settings = load('app/api/settings/telegram/route.ts', mocks)
const posts = load('app/api/posts/route.ts', mocks)
const item = load('app/api/posts/[id]/route.ts', mocks)
const duplicate = load('app/api/posts/[id]/duplicate/route.ts', mocks)
const options = load('app/api/posts/options/route.ts', mocks)
const payload = { title: 'Telegram article', slug: 'telegram-article', content: 'Video content', contentFormat: 'rich', isPublished: true }
const req = body => ({ json: async () => body })
const context = id => ({ params: Promise.resolve({ id }) })
const getBody = async response => ({ status: response.status, body: await response.json() })
const calls = name => state.calls.filter(call => call.name === name)
function reset() {
  state.actor = userA
  state.calls = []
  state.users = new Map([[userA.id, { telegramSettings: structuredClone(enabled) }], [userB.id, { telegramSettings: null }]])
  state.posts = new Map()
  state.nextId = 0
}
const tasks = []
const scenario = (name, run) => tasks.push({ name, run })

scenario('legacy null and malformed storage fail closed without account inheritance', async () => {
  for (const raw of [null, undefined, [], 'bad', { enabled: true, url: 'javascript:alert(1)' }, { enabled: 'false' }]) {
    assert.deepEqual(telegram.normalizeTelegramSettings(raw), telegram.defaultTelegramSettings())
  }
  assert.deepEqual(telegram.normalizeTelegramSettings(enabled), enabled)
  assert.equal(telegram.normalizeTelegramSettings({ enabled: false, url: enabled.url }).url, enabled.url)
})

scenario('schema accepts HTTPS Telegram invite and channel links', async () => {
  for (const url of ['https://t.me/+invite', 'https://t.me/channel', 'https://telegram.me/joinchat/invite']) {
    assert.equal(telegram.telegramSettingsSchema.parse({ ...enabled, url }).url, url)
  }
  assert.equal(telegram.telegramSettingsSchema.parse({ ...disabled, url: '' }).enabled, false)
})

scenario('schema rejects unsafe protocols, misleading hosts, credentials, empty enable and limits', async () => {
  for (const url of ['', 'http://t.me/group', '//t.me/group', 'javascript:alert(1)', 'https://t.me.evil.test/group', 'https://t.me@evil.test/group', 'https://evil.test@t.me/group', 'https://t.me:444/group', 'https://t.me', 'https://t.me\\evil.test/group', 'https://t.me/gr\noup', `https://t.me/${'a'.repeat(2048)}`]) {
    assert.equal(telegram.telegramSettingsSchema.safeParse({ ...enabled, url }).success, false, url)
  }
  for (const patch of [{ buttonText: '' }, { buttonText: 'a'.repeat(121) }, { disclaimer: 'a'.repeat(4001) }, { disclaimer: '\u0000' }, { enabled: 'true' }, { userId: userB.id }]) {
    assert.equal(telegram.telegramSettingsSchema.safeParse({ ...enabled, ...patch }).success, false)
  }
})

scenario('all feature endpoints require authenticated active actor before DB access', async () => {
  state.actor = null
  for (const handler of [() => settings.GET(), () => settings.PUT(req(enabled)), () => options.GET(), () => posts.POST(req(payload)), () => item.PUT(req(payload), context('post-1')), () => duplicate.POST(req({}), context('post-1'))]) {
    assert.equal((await handler()).status, 401)
  }
  assert.equal(state.calls.length, 0)
})

scenario('GET defaults reads only current actor even administrator', async () => {
  assert.deepEqual((await getBody(await settings.GET())).body, enabled)
  assert.deepEqual(calls('user.findUnique')[0].args, { where: { id: userA.id }, select: { telegramSettings: true } })
  state.actor = userB
  assert.deepEqual((await getBody(await settings.GET())).body, telegram.defaultTelegramSettings())
  assert.equal(calls('user.findUnique')[1].args.where.id, userB.id)
})

scenario('PUT saves and returns normalized account default without touching another tenant or posts', async () => {
  const response = await getBody(await settings.PUT(req({ ...enabled, url: `  ${enabled.url}  `, buttonText: '  Join  ' })))
  assert.equal(response.status, 200)
  assert.equal(response.body.buttonText, 'Join')
  assert.equal(response.body.url, enabled.url)
  assert.deepEqual(state.users.get(userB.id), { telegramSettings: null })
  assert.equal(calls('user.update')[0].args.where.id, userA.id)
  assert.equal(state.calls.some(call => call.name.startsWith('post.')), false)
})

scenario('invalid account changes produce 400 without writes', async () => {
  for (const body of [{ ...enabled, url: 'https://evil.test/a' }, { ...enabled, userId: userB.id }, { ...disabled, url: 'http://t.me/group' }, null]) {
    assert.equal((await settings.PUT(req(body))).status, 400)
  }
  assert.equal((await settings.PUT({ json: async () => { throw new SyntaxError('bad JSON') } })).status, 400)
  assert.equal(calls('user.update').length, 0)
})

scenario('options exposes account defaults and tenant-scoped options', async () => {
  const response = await getBody(await options.GET())
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.telegramDefaults, enabled)
  assert.deepEqual(calls('popup.findMany')[0].args.where, { userId: userA.id, isActive: true })
  assert.equal(calls('user.findUnique')[0].args.where.id, userA.id)
})

scenario('new post snapshots account defaults when omitted', async () => {
  const response = await getBody(await posts.POST(req(payload)))
  assert.equal(response.status, 201)
  assert.deepEqual(response.body.items[0].telegramSettings, enabled)
  assert.equal(calls('user.findUnique').length, 1)
  assert.equal(calls('post.create')[0].args.data.userId, userA.id)
})

scenario('bulk popup posts snapshot account default once consistently', async () => {
  const response = await getBody(await posts.POST(req({ ...payload, popupIds: ['p1', 'p2'] })))
  assert.equal(response.status, 201)
  assert.equal(response.body.created, 2)
  assert.equal(calls('user.findUnique').length, 1)
  for (const post of response.body.items) assert.deepEqual(post.telegramSettings, enabled)
})

scenario('new post explicit off overrides enabled account default and skips account lookup', async () => {
  const response = await getBody(await posts.POST(req({ ...payload, telegramSettings: disabled })))
  assert.equal(response.status, 201)
  assert.deepEqual(response.body.items[0].telegramSettings, disabled)
  assert.equal(calls('user.findUnique').length, 0)
})

scenario('new tenant with no defaults creates disabled snapshot', async () => {
  state.actor = userB
  const response = await getBody(await posts.POST(req(payload)))
  assert.deepEqual(response.body.items[0].telegramSettings, telegram.defaultTelegramSettings())
})

scenario('account changes never rewrite previously created post snapshot', async () => {
  const created = (await getBody(await posts.POST(req(payload)))).body.items[0]
  await settings.PUT(req({ ...disabled, url: 'https://t.me/another' }))
  assert.deepEqual(state.posts.get(created.id).telegramSettings, enabled)
  const next = (await getBody(await posts.POST(req({ ...payload, slug: 'another' })))).body.items[0]
  assert.equal(next.telegramSettings.enabled, false)
  assert.equal(next.telegramSettings.url, 'https://t.me/another')
})

scenario('post update omission preserves snapshot and explicit off changes only own post', async () => {
  const created = (await getBody(await posts.POST(req(payload)))).body.items[0]
  await settings.PUT(req(disabled))
  assert.equal((await item.PUT(req({ ...payload, title: 'Edited' }), context(created.id))).status, 200)
  assert.deepEqual(state.posts.get(created.id).telegramSettings, enabled)
  assert.equal(Object.hasOwn(calls('post.updateMany')[0].args.data, 'telegramSettings'), false)
  assert.equal((await item.PUT(req({ ...payload, telegramSettings: disabled }), context(created.id))).status, 200)
  assert.deepEqual(state.posts.get(created.id).telegramSettings, disabled)
  assert.deepEqual(calls('post.updateMany')[1].args.where, { id: created.id, userId: userA.id })
})

scenario('update and duplicate reject cross-tenant post IDs even for admin', async () => {
  const created = (await getBody(await posts.POST(req(payload)))).body.items[0]
  state.actor = userB
  assert.equal((await item.PUT(req({ ...payload, telegramSettings: disabled }), context(created.id))).status, 404)
  assert.equal((await duplicate.POST(req({}), context(created.id))).status, 404)
  assert.deepEqual(state.posts.get(created.id).telegramSettings, enabled)
  assert.equal(state.posts.size, 1)
})

scenario('post create/update invalid Telegram field is rejected before any write', async () => {
  for (const telegramSettings of [{ ...enabled, url: 'javascript:alert(1)' }, null, { ...enabled, buttonText: '' }]) {
    assert.equal((await posts.POST(req({ ...payload, telegramSettings }))).status, 400)
    assert.equal((await item.PUT(req({ ...payload, telegramSettings }), context('missing'))).status, 400)
  }
  assert.equal(calls('post.create').length + calls('post.updateMany').length, 0)
})

scenario('duplicate copies source snapshot rather than current account default', async () => {
  const created = (await getBody(await posts.POST(req(payload)))).body.items[0]
  await settings.PUT(req(disabled))
  const response = await getBody(await duplicate.POST(req({}), context(created.id)))
  assert.equal(response.status, 201)
  assert.deepEqual(response.body.telegramSettings, enabled)
  assert.equal(response.body.isPublished, false)
})

scenario('duplicate legacy null remains null and disabled despite enabled defaults', async () => {
  state.posts.set('legacy', { ...payload, id: 'legacy', userId: userA.id, telegramSettings: null })
  const response = await getBody(await duplicate.POST(req({}), context('legacy')))
  assert.equal(response.status, 201)
  assert.equal(response.body.telegramSettings, null)
  assert.equal(telegram.normalizeTelegramSettings(response.body.telegramSettings).enabled, false)
  assert.equal(calls('user.findUnique').length, 0)
})

;(async () => {
  for (const { name, run } of tasks) {
    reset()
    await run()
    console.log(`PASS ${name}`)
  }
  console.log(`RESULT=PASS scenarios=${tasks.length}`)
})().catch(error => { console.error(error); process.exitCode = 1 })
