/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise the real editor, API routes, validation and converter with deterministic storage/network.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const sourceRoot = path.resolve(process.env.AFFILIATE_TEST_ROOT || path.join(__dirname, '..'))
const baseline = process.argv.includes('--baseline')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/dashboard/popups', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement
global.FormData = dom.window.FormData
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const cache = new Map()
const clone = value => structuredClone(value)
const owner = { id: 'fixture-owner', email: 'owner@example.test', status: 'active', deletedAt: null, adminRole: null }
const state = { authorized: true, rows: [], dbWrites: [], requests: [], network: [], pending: null, routes: new Map(), nextId: 1 }
const prisma = {
  user: { findUnique: async () => state.authorized ? owner : null },
  $transaction: async operations => Promise.all(operations),
  popupTemplate: {
    count: async () => state.rows.length,
    findMany: async () => clone(state.rows),
    findFirst: async ({ where }) => clone(state.rows.find(row => row.id === where.id && row.userId === where.userId) || null),
    create: async ({ data }) => {
      state.dbWrites.push(clone(data))
      const row = { id: `popup-${state.nextId++}`, _count: { posts: 0 }, ...clone(data) }
      state.rows.push(row); return clone(row)
    },
    updateMany: async ({ where, data }) => {
      const row = state.rows.find(item => item.id === where.id && item.userId === where.userId)
      if (!row) return { count: 0 }
      state.dbWrites.push(clone(data)); Object.assign(row, clone(data)); return { count: 1 }
    },
  },
}
function load(file) {
  file = file.replaceAll('\\', '/')
  if (!path.extname(file)) file += fs.existsSync(path.join(sourceRoot, file + '.tsx')) ? '.tsx' : '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }; cache.set(file, fixture)
  const code = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const localRequire = id => {
    if (id === '@/lib/prisma') return { prisma }
    if (id === '@/lib/auth-options') return { authOptions: {} }
    if (id === 'next-auth') return { getServerSession: async () => state.authorized ? { user: { email: owner.email } } : null }
    if (id === 'next/link') return props => React.createElement('a', { href: props.href }, props.children)
    if (id.includes('PopupClickStats')) return { usePopupCounts: () => ({ data: null }), PopupClickBadge: () => null, PopupClickSummary: () => null }
    if (id.endsWith('/PopupTiming')) return { PopupTimingPreview: () => null }
    if (id.startsWith('@/')) return load(id.slice(2))
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports)
  return fixture.exports
}
const settingsModule = load('lib/popup-settings.ts')
const management = load('lib/content-management.ts')
const resolver = load('app/api/content/resolve-affiliate/route.ts')
const popups = load('app/api/popups/route.ts')
const popupItem = load('app/api/popups/[id]/route.ts')
const short = 'https://vt.tiktok.com/ZSFIXTURE/'
const shopee = 'https://shopee.vn/product/123/456?aff=keep%2f&A=1+2'
const product = 'https://www.tiktok.com/view/product/1729605979383696179'
const signedQuery = '?checksum=A%2fb%2FC&affiliate=a+b%3D%3D&same=1&same=2&empty=&emoji=%F0%9F%98%80'
const longUrl = (length, prefix = product + signedQuery + '&payload=') => prefix + 'x'.repeat(length - prefix.length)
const resultResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function resolve(url) { const response = await resolver.POST({ json: async () => ({ url }) }); return { status: response.status, body: await response.json() } }
function payload(secondUrl = short) { return { name: 'Fixture popup', firstUrl: shopee, secondUrl, settings: settingsModule.defaultPopupSettings(shopee, secondUrl) } }
async function saveApi(data, id = null) {
  const response = id ? await popupItem.PUT({ json: async () => data }, { params: Promise.resolve({ id }) }) : await popups.POST({ json: async () => data })
  return { status: response.status, body: await response.json() }
}
global.fetch = async (url, init = {}) => {
  url = String(url)
  if (url.startsWith('/')) {
    state.requests.push({ url, ...init })
    if (url.startsWith('/api/popups?')) return popups.GET({ nextUrl: new URL('https://fixture.example' + url) })
    if (url === '/api/content/resolve-affiliate') {
      if (state.pending) { const pending = state.pending; state.pending = null; return pending.promise }
      return resolver.POST({ json: async () => JSON.parse(init.body) })
    }
    if (url === '/api/popups' && init.method === 'POST') return popups.POST({ json: async () => JSON.parse(init.body) })
    if (url.startsWith('/api/popups/') && init.method === 'PUT') return popupItem.PUT({ json: async () => JSON.parse(init.body) }, { params: Promise.resolve({ id: url.split('/').at(-1) }) })
    throw new Error('Unexpected app fetch ' + url)
  }
  state.network.push(url)
  const route = state.routes.get(url)
  if (route instanceof Error) throw route
  if (!route) throw new Error('Unexpected external fetch ' + url)
  return new Response(route.body || '', { status: route.status || 200, headers: route.location ? { location: route.location } : {} })
}
function networkResolution(source, target) {
  state.routes.set(source, { status: 302, location: target })
  state.routes.set(target, { body: '<html><title>fixture</title></html>' })
}
const timers = new Map(); let timerId = 0
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.confirm = () => true
const flushTimers = async () => React.act(async () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn() } })
const dialog = () => document.querySelector('form[role="dialog"]')
const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const field = text => [...dialog().querySelectorAll('label')].find(item => item.textContent.startsWith(text))?.querySelector('input')
const android = () => field('Link TikTok cho Android')
const ios = () => field('Link TikTok cho iOS')
const resolveButton = (platform = 'tiktok') => [...dialog().querySelectorAll('fieldset')].find(item => item.textContent.includes(platform === 'tiktok' ? 'Link TikTok cho Android' : 'Link Shopee Desktop'))?.querySelector('button')
const click = async element => { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function input(element, value) {
  assert.ok(element, 'Input target exists')
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
const submit = async () => { assert.equal(dialog().checkValidity(), true, 'Native required/type validation passes'); await React.act(async () => dialog().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
const settle = async (pending, body, status = 200) => React.act(async () => pending.resolve(resultResponse(body, status)))
async function createForm(source = short) {
  if (dialog()) await click(button('Hủy'))
  await click(button('Tạo popup'))
  await input(field('Tên popup'), 'Fixture popup')
  await input(field('Link Shopee Desktop'), shopee)
  await input(android(), source)
}
const tests = []
const scenario = (name, run) => tests.push({ name, run })
let reactRoot
async function mount() {
  state.rows = []
  const Manager = load('app/dashboard/popups/PopupManager.tsx').default
  reactRoot = createRoot(document.getElementById('root'))
  await React.act(async () => reactRoot.render(React.createElement(Manager)))
  await flushTimers()
}

if (baseline) {
  scenario('baseline popup schema rejects a 2049-character URL', () => {
    const result = management.popupSchema.safeParse(payload(longUrl(2049)))
    assert.equal(result.success, false)
    assert.equal(result.error.issues[0].message, 'Too big: expected string to have <=2048 characters')
  })
  scenario('baseline resolver rejects a 2049-character Android URL', async () => {
    const result = await resolve(longUrl(2049)); assert.equal(result.status, 400)
    assert.equal(result.body.error, 'Too big: expected string to have <=2048 characters')
  })
  scenario('baseline normalizer silently falls back for long Android URL', () => {
    const saved = settingsModule.defaultPopupSettings(shopee, longUrl(3000))
    assert.equal(management.normalizeSettings(saved, shopee, short).tiktok.androidUrl, short)
  })
  scenario('baseline affiliate processing replaces Android and then cannot save', async () => {
    await mount(); await createForm()
    networkResolution(short, longUrl(3000))
    await click(resolveButton())
    assert.equal(android().value, longUrl(3000))
    await submit()
    assert.match(document.querySelector('[role="alert"]').textContent, /<=2048 characters/)
    assert.equal(state.dbWrites.length, 0)
  })
} else {
  scenario('resolver and popup APIs authenticate before network or writes', async () => {
    state.authorized = false
    const calls = state.network.length; const writes = state.dbWrites.length
    assert.equal((await resolve(short)).status, 401)
    assert.equal((await saveApi(payload())).status, 401)
    assert.equal((await saveApi(payload(), 'missing')).status, 401)
    assert.equal(state.network.length, calls); assert.equal(state.dbWrites.length, writes)
    state.authorized = true
  })
  for (const length of [2048, 2049, 4096, 8192]) scenario(`real API creates and edits exact ${length}-character URLs`, async () => {
    const url = longUrl(length); const data = payload(url)
    const saved = await saveApi(data); assert.equal(saved.status, 201)
    for (const key of ['url', 'androidUrl', 'iosUrl']) assert.equal(saved.body.settings.tiktok[key], url)
    assert.equal(saved.body.secondUrl, url)
    const edited = await saveApi({ ...data, name: 'Updated fixture' }, saved.body.id)
    assert.equal(edited.status, 200); assert.equal(edited.body.settings.tiktok.androidUrl, url)
    assert.equal(edited.body.settings.tiktok.iosUrl, url)
    state.routes.set(url, { body: '<html></html>' })
    const resolved = await resolve(url); assert.equal(resolved.status, 200); assert.equal(resolved.body.url, url)
    assert.equal(resolved.body.originalUrl, url)
    assert.equal(management.normalizeSettings(data.settings, shopee, short).tiktok.androidUrl, url)
  })
  for (const key of ['firstUrl', 'secondUrl']) scenario(`over-limit ${key} rejected without database mutation`, async () => {
    const before = state.dbWrites.length; const data = { ...payload(), [key]: longUrl(8193) }
    const result = await saveApi(data); assert.equal(result.status, 400)
    assert.match(result.body.error, /8192/); assert.doesNotMatch(result.body.error, /Too big/)
    assert.equal(state.dbWrites.length, before)
  })
  for (const key of ['url', 'androidUrl', 'iosUrl']) scenario(`over-limit nested TikTok ${key} rejected rather than silently replaced`, async () => {
    const before = state.dbWrites.length; const data = payload(); data.settings.tiktok[key] = longUrl(8193)
    const result = await saveApi(data); assert.equal(result.status, 400)
    assert.match(result.body.error, /8192/); assert.equal(state.dbWrites.length, before)
  })
  scenario('resolver rejects over-limit input before a network request', async () => {
    const count = state.network.length; const result = await resolve(longUrl(8193))
    assert.equal(result.status, 400); assert.match(result.body.error, /8192/)
    assert.equal(state.network.length, count)
  })
  for (const url of ['javascript:alert(1)', 'https://user:pass@www.tiktok.com/view/product/1729605979383696179']) scenario('resolver rejects unsafe protocol or credentials: ' + url.split(':')[0], async () => {
    const count = state.network.length; const result = await resolve(url)
    assert.equal(result.status, 400); assert.equal(state.network.length, count)
  })
  scenario('resolver preserves signed query byte-for-byte across short-link expansion', async () => {
    const official = 'https://www.tiktok.com/@shop/pdp/1729605979383696179' + signedQuery
    networkResolution(short, official)
    const result = await resolve(short)
    assert.equal(result.status, 200); assert.equal(result.body.url, product + signedQuery)
    assert.equal(result.body.originalUrl, short)
  })
  scenario('oversized redirect returns warning/original and never follows oversized URL', async () => {
    state.routes.set(short, { status: 302, location: longUrl(8193) }); state.network = []
    const result = await resolve(short)
    assert.equal(result.status, 200); assert.equal(result.body.url, short); assert.match(result.body.warning, /8192/)
    assert.deepEqual(state.network, [short])
  })
  scenario('converted output exceeding limit is not truncated or returned as success', async () => {
    const official = longUrl(8192, 'https://www.tiktok.com/pdp/1729605979383696179?payload=')
    state.routes.set(official, { body: '<html></html>' })
    const result = await resolve(official)
    assert.equal(result.status, 200); assert.equal(result.body.url, official); assert.match(result.body.warning, /8192/)
  })
  scenario('Shopee redirect keeps full query and metadata', async () => {
    const source = 'https://shopee.vn/short'; const target = shopee + '&next=keep%2Fraw'
    networkResolution(source, target); state.routes.set(target, { body: '<meta property="og:title" content="Fixture"><meta property="og:image" content="https://cdn.example.test/image.png">' })
    const result = await resolve(source)
    assert.equal(result.body.url, target); assert.equal(result.body.title, 'Fixture'); assert.equal(result.body.image, 'https://cdn.example.test/image.png')
  })
  scenario('new popup resolves only iOS, retains Android, and saves long iOS successfully', async () => {
    await mount(); await createForm(); networkResolution(short, longUrl(3000))
    await click(resolveButton())
    assert.equal(android().value, short); assert.equal(ios().value, longUrl(3000))
    assert.equal(dialog().checkValidity(), true)
    await submit(); assert.equal(dialog(), null)
    const saved = state.rows.at(-1)
    assert.equal(saved.secondUrl, short); assert.equal(saved.settings.tiktok.url, short)
    assert.equal(saved.settings.tiktok.androidUrl, short); assert.equal(saved.settings.tiktok.iosUrl, longUrl(3000))
  })
  scenario('edit and repeated processing always resolve original Android source', async () => {
    await click(document.querySelector('button[title="Sửa"]'))
    for (const size of [3100, 3200]) {
      networkResolution(short, longUrl(size)); await click(resolveButton())
      assert.equal(JSON.parse(state.requests.filter(item => item.url === '/api/content/resolve-affiliate').at(-1).body).url, short)
      assert.equal(android().value, short); assert.equal(ios().value, longUrl(size))
    }
    await submit(); assert.equal(state.rows[0].secondUrl, short); assert.equal(state.rows[0].settings.tiktok.iosUrl, longUrl(3200))
  })
  scenario('8192-character Android URL survives UI input and API save', async () => {
    await createForm(longUrl(8192)); await submit()
    assert.equal(dialog(), null); assert.equal(state.rows.at(-1).secondUrl, longUrl(8192))
    assert.equal(state.rows.at(-1).settings.tiktok.androidUrl, longUrl(8192))
  })
  scenario('UI preserves oversized pasted source and explicitly rejects processing/save', async () => {
    const before = state.dbWrites.length
    await createForm(longUrl(8193))
    assert.equal(android().value, longUrl(8193), 'No silent signed-query truncation')
    const requests = state.requests.filter(item => item.url === '/api/content/resolve-affiliate').length
    await click(resolveButton())
    assert.equal(state.requests.filter(item => item.url === '/api/content/resolve-affiliate').length, requests)
    assert.match(dialog().querySelector('[role="alert"]').textContent, /8192/)
    await submit(); assert.ok(dialog()); assert.equal(state.dbWrites.length, before)
    assert.equal(android().value, longUrl(8193))
  })
  scenario('successful OneLink changes iOS mode and image, never Android', async () => {
    await createForm(); const pending = deferred(); state.pending = pending
    await click(resolveButton())
    const target = 'https://snssdk1180.onelink.me/BAuo?af_dp=keep%3A%2F%2Fsigned'
    await settle(pending, { url: target, image: 'https://cdn.example.test/creative.png' })
    assert.equal(android().value, short); assert.equal(ios().value, target)
    assert.match(dialog().innerHTML, /creative\.png/)
    await submit(); assert.equal(state.rows.at(-1).settings.tiktok.iosMode, 'onelink')
    assert.equal(state.rows.at(-1).settings.tiktok.androidUrl, short)
  })
  for (const failure of ['warning', 'error', 'invalid', 'oversized']) scenario(`${failure} resolver response preserves all current links`, async () => {
    await createForm(); const oldIos = product + '?saved=ios'; await input(ios(), oldIos)
    const pending = deferred(); state.pending = pending; await click(resolveButton())
    const body = failure === 'warning' ? { url: short, warning: 'Fixture warning' }
      : failure === 'error' ? { error: 'Fixture error' }
        : { url: failure === 'invalid' ? 'javascript:alert(1)' : longUrl(8193) }
    await settle(pending, body, failure === 'error' ? 400 : 200)
    assert.equal(android().value, short); assert.equal(ios().value, oldIos)
    await submit(); const saved = state.rows.at(-1)
    assert.equal(saved.secondUrl, short); assert.equal(saved.settings.tiktok.url, short)
    assert.equal(saved.settings.tiktok.androidUrl, short); assert.equal(saved.settings.tiktok.iosUrl, oldIos)
  })
  for (const change of ['android', 'ios', 'mode']) scenario(`pending response cannot overwrite edited ${change}`, async () => {
    await createForm(); const oldIos = product + '?saved=before'; await input(ios(), oldIos)
    const pending = deferred(); state.pending = pending; await click(resolveButton())
    assert.equal(dialog().querySelector('button[type="submit"]').disabled, true)
    const nextAndroid = 'https://vt.tiktok.com/NEW/'; const nextIos = product + '?manual=after'
    if (change === 'android') await input(android(), nextAndroid)
    if (change === 'ios') await input(ios(), nextIos)
    if (change === 'mode') await click(button('Nhập OneLink'))
    await settle(pending, { url: product + '?stale=resolved', image: 'https://cdn.example.test/stale.png' })
    assert.equal(android().value, change === 'android' ? nextAndroid : short)
    assert.equal(ios().value, change === 'ios' ? nextIos : oldIos)
    assert.doesNotMatch(dialog().innerHTML, /stale\.png/)
    assert.equal(resolveButton().disabled, false)
  })
  scenario('closed/reopened editor rejects old response and new request remains pending', async () => {
    await createForm(); const first = deferred(); state.pending = first; await click(resolveButton())
    await click(button('Hủy')); await createForm('https://vt.tiktok.com/SECOND/')
    const second = deferred(); state.pending = second; await click(resolveButton())
    await settle(first, { url: product + '?stale=closed' })
    assert.equal(android().value, 'https://vt.tiktok.com/SECOND/'); assert.equal(ios().value, 'https://vt.tiktok.com/SECOND/')
    assert.equal(dialog().querySelector('button[type="submit"]').disabled, true)
    await settle(second, { url: product + '?current=resolved' })
    assert.equal(android().value, 'https://vt.tiktok.com/SECOND/'); assert.equal(ios().value, product + '?current=resolved')
    assert.equal(dialog().querySelector('button[type="submit"]').disabled, false)
  })
  scenario('Shopee UI processing updates Shopee only, keeps both TikTok URLs', async () => {
    await createForm(); await input(ios(), product + '?ios=unchanged')
    const target = shopee + '&resolved=1'; networkResolution(shopee, target)
    await click(resolveButton('shopee'))
    assert.equal(field('Link Shopee Desktop').value, target)
    assert.equal(android().value, short); assert.equal(ios().value, product + '?ios=unchanged')
    await submit(); assert.equal(state.rows.at(-1).firstUrl, target)
  })
}

async function run() {
  let passed = 0
  try {
    for (const test of tests) {
      try { await test.run(); passed += 1; console.log('PASS ' + test.name) }
      catch (error) { console.error('FAIL ' + test.name); throw error }
    }
    console.log(baseline ? `BASELINE_OK popup-affiliate=${passed} bugs=android-overwrite,2048-limit` : `RESULT=PASS popup-affiliate=${passed}`)
  } finally {
    if (reactRoot) await React.act(async () => reactRoot.unmount())
    dom.window.close()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
