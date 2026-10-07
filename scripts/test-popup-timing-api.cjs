/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise the real dashboard route handlers with owner-scoped Prisma/auth fixtures.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const state = {
  actor: null,
  calls: [],
  ownsPopup: true,
  updateCount: 1,
  post: {
    id: 'post-1',
    userId: 'owner-1',
    title: 'Timer article',
    slug: 'bai-timer',
    sharedDomain: null,
    popup: {
      id: 'popup-1',
      name: 'Popup timer',
      isActive: true,
      settings: { shopee: { delaySeconds: 0 }, tiktok: { delaySeconds: 0 }, cooldownMinutes: 0 },
    },
    domain: null,
  },
}

function record(name, value) {
  state.calls.push({ name, value })
}

function makePrisma() {
  return {
    $transaction: async operations => typeof operations === 'function' ? operations(prisma) : Promise.all(operations),
    user: { findUnique: async () => ({ telegramSettings: null }) },
    managedPost: {
      count: async args => { record('managedPost.count', args); return 1 },
      findMany: async args => { record('managedPost.findMany', args); return [state.post] },
      findFirst: async args => { record('managedPost.findFirst', args); return state.post },
      updateMany: async args => { record('managedPost.updateMany', args); return { count: state.updateCount } },
      create: async args => { record('managedPost.create', args); return state.post },
    },
    popupTemplate: {
      findMany: async args => {
        record('popupTemplate.findMany', args)
        return [{ id: 'popup-1', name: 'Popup timer', imageUrl: null, settings: state.post.popup.settings }]
      },
    },
  }
}

const prisma = makePrisma()
const contentManagement = {
  getManagedContentActor: async () => { record('getManagedContentActor', null); return state.actor },
  getPublicationTargets: async userId => { record('getPublicationTargets', { userId }); return [{ id: null, domain: 'rutgonlink.site', kind: 'primary' }] },
  ownsActivePopups: async (userId, popupIds) => { record('ownsActivePopups', { userId, popupIds }); return state.ownsPopup },
  ownsPopupRecord: async (userId, popupId) => { record('ownsPopupRecord', { userId, popupId }); return state.ownsPopup },
  normalizeContent: (value) => value,
  normalizeContentFormat: value => value || 'plain',
  validatePublicationTarget: async (userId, domainId, sharedDomain) => { record('validatePublicationTarget', { userId, domainId, sharedDomain }); return { domainId: domainId || null, sharedDomain: sharedDomain || null } },
  postSchema: { parse: value => value },
  createPostSchema: { parse: value => value },
}

const moduleCache = new Map()
function load(file) {
  if (moduleCache.has(file)) return moduleCache.get(file).exports
  const fixtureModule = { exports: {} }
  moduleCache.set(file, fixtureModule)
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const localRequire = id => {
    if (id === '@/lib/content-management') return contentManagement
    if (id === '@/lib/prisma') return { prisma }
    if (id === '@/lib/site-config') return { getSiteHostname: () => 'rutgonlink.site' }
    if (id === '@/lib/telegram-settings') return load('lib/telegram-settings.ts')
    if (id === '@/lib/public-post-link') return load('lib/public-post-link.ts')
    if (id === '@/lib/numeric-post-link-server') return load('lib/numeric-post-link-server.ts')
    if (id === '@prisma/client') return { Prisma: { PrismaClientKnownRequestError: class extends Error {} } }
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixtureModule, fixtureModule.exports)
  return fixtureModule.exports
}

function request(url, body) {
  return {
    nextUrl: new URL(url),
    json: async () => body,
  }
}

async function json(response) {
  return { status: response.status, body: await response.json() }
}

function calls(name) {
  return state.calls.filter(call => call.name === name)
}

async function main() {
  const posts = load('app/api/posts/route.ts')
  const options = load('app/api/posts/options/route.ts')
  const item = load('app/api/posts/[id]/route.ts')
  const payload = {
    title: 'Edited timer article', slug: 'edited-timer', excerpt: null, content: 'Content',
    contentFormat: 'plain', popupId: 'popup-1', popupIds: ['popup-1'], domainId: null,
    sharedDomain: null, previewImage: null, isFakeVideo: false, isPublished: true,
  }
  const context = { params: Promise.resolve({ id: 'post-1' }) }
  const postRequest = () => request('https://rutgonlink.site/api/posts/post-1', payload)

  state.actor = null
  for (const handler of [() => posts.GET(postRequest()), () => options.GET(), () => posts.POST(postRequest()), () => item.PUT(postRequest(), context)]) {
    state.calls.length = 0
    const unauthorized = await json(await handler())
    assert.equal(unauthorized.status, 401)
    assert.deepEqual(state.calls.map(call => call.name), ['getManagedContentActor'], 'Unauthenticated requests must stop before queries or ownership checks')
  }

  state.actor = { id: 'owner-1', email: 'owner@example.test', isAdmin: false }
  state.calls.length = 0
  const listed = await json(await posts.GET(request('https://rutgonlink.site/api/posts?page=1&pageSize=10')))
  assert.equal(listed.status, 200)
  assert.deepEqual(listed.body.items[0].popup.settings, state.post.popup.settings)
  assert.deepEqual(calls('managedPost.count')[0].value.where, { userId: 'owner-1' })
  assert.deepEqual(calls('managedPost.findMany')[0].value.where, { userId: 'owner-1' })
  assert.equal(calls('managedPost.findMany')[0].value.include.popup.select.settings, true)

  state.calls.length = 0
  const available = await json(await options.GET())
  assert.equal(available.status, 200)
  assert.deepEqual(available.body.popups[0].settings, state.post.popup.settings)
  const popupQuery = calls('popupTemplate.findMany')[0].value
  assert.deepEqual(popupQuery.where, { userId: 'owner-1', isActive: true })
  assert.equal(popupQuery.select.settings, true)
  assert.deepEqual(calls('getPublicationTargets')[0].value, { userId: 'owner-1' })

  state.calls.length = 0
  const created = await json(await posts.POST(postRequest()))
  assert.equal(created.status, 201)
  assert.deepEqual(created.body.items[0].popup.settings, state.post.popup.settings)
  assert.deepEqual(calls('ownsActivePopups')[0].value, { userId: 'owner-1', popupIds: ['popup-1'] })
  assert.equal(calls('managedPost.create')[0].value.data.userId, 'owner-1')
  assert.equal(calls('managedPost.create')[0].value.include.popup.select.settings, true)

  state.calls.length = 0
  state.post.popup.isActive = false
  const updated = await json(await item.PUT(postRequest(), context))
  assert.equal(updated.status, 200)
  assert.deepEqual(updated.body.popup.settings, state.post.popup.settings)
  assert.equal(updated.body.popup.isActive, false, 'Existing inactive popup timing remains visible in the editor')
  assert.deepEqual(calls('ownsPopupRecord')[0].value, { userId: 'owner-1', popupId: 'popup-1' })
  assert.deepEqual(calls('managedPost.updateMany')[0].value.where, { id: 'post-1', userId: 'owner-1' })
  assert.deepEqual(calls('managedPost.findFirst')[0].value.where, { id: 'post-1', userId: 'owner-1' })
  assert.equal(calls('managedPost.findFirst')[0].value.include.popup.select.settings, true)

  state.ownsPopup = false
  for (const handler of [() => posts.POST(postRequest()), () => item.PUT(postRequest(), context)]) {
    state.calls.length = 0
    assert.equal((await handler()).status, 400)
    assert.equal(state.calls.some(call => call.name.startsWith('managedPost.')), false)
  }
  state.ownsPopup = true
  state.updateCount = 0
  state.calls.length = 0
  assert.equal((await item.PUT(postRequest(), context)).status, 404)
  assert.equal(calls('managedPost.findFirst').length, 0, 'Do not reread another tenant or missing post')

  console.log('RESULT=PASS unauthorized=4 settings-responses=4 rejected-ownership=2 missing-post=1')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
