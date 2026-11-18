/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// Exercise real schemas, handlers and renderer with a transactional database fixture.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { Prisma } = require('@prisma/client')
const { renderToStaticMarkup } = require('react-dom/server')
const { NextRequest, NextResponse } = require('next/server')

process.env.NEXTAUTH_URL = 'https://rutgonlink.site'
const root = path.resolve(__dirname, '..')
const state = { actor: { id: 'owner', isAdmin: false }, adminContext: null, rows: new Map(), appSettings: new Map(), audits: [], calls: [], nextId: 0, nextCode: 50000, codes: [], failCreate: 0, alwaysCollide: false, createError: null, transactions: 0, defaultsRead: 0, popupOwner: true }
const cache = new Map()
const telegram = { enabled: true, url: 'https://t.me/fixture', buttonText: 'Join', disclaimer: 'Fixture' }
const legacy = { title: 'Fixture', slug: 'legacy-name', content: '<p>Video fixture</p>', contentFormat: 'rich', isPublished: true, telegramSettings: telegram }
const collision = () => new Prisma.PrismaClientKnownRequestError('Fixture collision', { code: 'P2002', clientVersion: 'test' })

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(item => matches(row, item))
    if (key === 'OR') return value.some(item => matches(row, item))
    if (key === 'user') {
      return row.user.status === value.status && row.user.deletedAt === value.deletedAt
    }
    return row[key] === value
  })
}
const prisma = {
  $transaction: async operation => {
    if (Array.isArray(operation)) return Promise.all(operation)
    state.transactions += 1
    const before = structuredClone(state.rows)
    try { return await operation(prisma) } catch (error) { state.rows = before; throw error }
  },
  user: {
    findUnique: async () => { state.defaultsRead += 1; return { telegramSettings: telegram } },
  },
  appSetting: {
    findUnique: async ({ where }) => state.appSettings.get(where.key) || null,
    upsert: async ({ where, create, update }) => {
      const existing = state.appSettings.get(where.key)
      const next = existing ? { ...existing, ...update, updatedAt: new Date() } : { id: `setting-${where.key}`, ...create, createdAt: new Date(), updatedAt: new Date() }
      state.appSettings.set(where.key, next)
      return next
    },
  },
  adminAuditLog: {
    create: async ({ data }) => { state.audits.push(data); return data },
  },
  domain: {
    findFirst: async ({ where }) => where.domain === 'custom.example.test' ? { id: 'custom' } : null,
    findMany: async () => [],
  },
  popupTemplate: {
    findMany: async () => [],
  },
  link: { findFirst: async () => { throw new Error('Numeric routes must never resolve a short link') } },
  click: { create: async () => { throw new Error('Numeric routes must never write short-link analytics') } },
  managedPost: {
    findUnique: async ({ where }) => [...state.rows.values()].find(row => row.slug === where.slug) || null,
    findFirst: async ({ where, orderBy }) => {
      const list = [...state.rows.values()].filter(row => matches(row, where))
      if (orderBy) list.sort((a, b) => (b.createdAt - a.createdAt) || b.id.localeCompare(a.id))
      return list[0] || null
    },
    count: async ({ where }) => [...state.rows.values()].filter(row => matches(row, where)).length,
    findMany: async ({ where }) => [...state.rows.values()].filter(row => matches(row, where)),
    create: async ({ data }) => {
      state.calls.push(structuredClone(data))
      if (state.createError) throw state.createError
      if (state.alwaysCollide || state.calls.length === state.failCreate || [...state.rows.values()].some(row => row.slug === data.slug)) throw collision()
      const row = { id: `post-${++state.nextId}`, popup: null, domain: data.domainId === 'custom' ? { id: 'custom', domain: 'custom.example.test' } : null, user: { status: 'active', deletedAt: null, managedContentBlocks: [] }, createdAt: new Date(Date.UTC(2026, 9, 7, 0, state.nextId)), isDirectWrapper: false, ...data }
      state.rows.set(row.id, row)
      return row
    },
    updateMany: async ({ where, data }) => {
      const row = [...state.rows.values()].find(row => matches(row, where))
      if (!row) return { count: 0 }
      Object.assign(row, data)
      return { count: 1 }
    },
  },
}
const allowed = new Set(['content-management', 'public-post-link', 'numeric-post-link-server', 'post-fallback-config', 'post-default-domain-config', 'tranco-boost-config', 'admin-audit', 'popup-settings', 'popup-link', 'popup-browser-gate', 'popup-settings-server', 'tiktok-link', 'popup-affiliate-url', 'intermediate-image', 'site-config', 'shared-domains', 'video-embed', 'post-preview', 'public-post-guard', 'telegram-settings', 'telegram-render', 'popup-click-client'])
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const localRequire = id => {
    if (id === '@/lib/prisma') return { prisma }
    if (id === 'node:crypto') return { ...require(id), randomInt: (min, max) => { const value = state.codes.length ? state.codes.shift() : state.nextCode++; assert(value >= min && value < max); return value } }
    if (id === '@/lib/popup-click-token') return { createPopupClickToken: () => 'fixture-only-token' }
    if (id === '@/lib/admin-auth') return {
      hasAdminPermission: (admin, permission) => Boolean(admin?.permissions?.includes(permission)),
      requireAdmin: async permission => state.adminContext?.permissions?.includes(permission)
        ? { ok: true, admin: state.adminContext }
        : { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) },
    }
    if (id === 'next-auth' || id === '@/lib/auth-options') return {}
    if (id === 'next/headers') return { headers: async () => new Headers({ host: 'rutgonlink.site', 'user-agent': 'Mozilla/5.0' }) }
    if (id === 'next/navigation') return {
      notFound: () => { throw new Error('Fixture not found') },
      redirect: url => { throw Object.assign(new Error('Fixture redirect'), { redirectUrl: url }) },
    }
    if (id === 'next/link' || id === '@/components/Navbar' || id === '@/components/Footer') return () => null
    if (id.startsWith('@/app/')) return load(id.slice(2) + '.ts')
    if (id.startsWith('./')) return load(path.posix.join(path.posix.dirname(file), id) + '.tsx')
    if (id.startsWith('@/lib/')) {
      if (!allowed.has(id.slice(6))) return {}
      const exports = load(id.slice(2) + '.ts')
      if (id !== '@/lib/content-management') return exports
      return { ...exports, getManagedContentActor: async () => state.actor, ownsActivePopups: async () => state.popupOwner, ownsPopupRecord: async () => state.popupOwner,
        normalizeContent: value => value, validatePublicationTarget: async (_owner, domainId, sharedDomain) => {
          if (domainId && domainId !== 'custom') throw new Error('Invalid publication domain')
          return { domainId: domainId || null, sharedDomain: sharedDomain || null }
        } }
    }
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}
const api = load('app/api/posts/route.ts')
const item = load('app/api/posts/[id]/route.ts')
const duplicate = load('app/api/posts/[id]/duplicate/route.ts')
const adminFallbackApi = load('app/api/admin/post-fallback/route.ts')
const adminTrancoApi = load('app/api/admin/tranco/route.ts')
const adminDefaultDomainApi = load('app/api/admin/domains/default-post-domain/route.ts')
const postOptionsApi = load('app/api/posts/options/route.ts')
const trancoConfig = load('lib/tranco-boost-config.ts')
const numericRoute = load('app/p7/[code]/route.ts')
const slugRoute = load('app/[shortCode]/route.ts')
const reactPage = load('app/posts/[slug]/page.tsx')
const links = load('lib/public-post-link.ts')
const request = body => ({ headers: new Headers(), json: async () => body })
const body = async response => ({ status: response.status, data: await response.json() })
const tasks = []
const scenario = (name, run) => tasks.push({ name, run })
function reset() {
  trancoConfig.clearTrancoBoostCache()
  Object.assign(state, { actor: { id: 'owner', isAdmin: false }, adminContext: null, rows: new Map(), appSettings: new Map(), audits: [], calls: [], nextId: 0, nextCode: 50000, codes: [], failCreate: 0, alwaysCollide: false, createError: null, transactions: 0, defaultsRead: 0, popupOwner: true })
}
async function create(patch = {}) { return body(await api.POST(request({ ...legacy, ...patch }))) }
async function visit(code, host = 'honghotngay228.site') {
  const request = new NextRequest(`https://${host}/p7/${code}`, { headers: { host, 'user-agent': 'Mozilla/5.0' } })
  return numericRoute.GET(request, { params: Promise.resolve({ code }) })
}

scenario('path helper recognizes exact five-digit namespace and leaves legacy URLs', async () => {
  assert.equal(links.getPublicPostPath('p7-90195'), '/p7/90195')
  for (const slug of ['old-article', '90195', 'p7-01234', 'p7-90195-copy']) assert.equal(links.getPublicPostPath(slug), '/' + slug)
  for (const code of ['01234', '1234', '123456', 'foo', '../90195', '90195?x=1']) assert.equal(links.numericPostSlug(code), null)
})
scenario('numeric create permits omitted slug, selected domain and response canonical', async () => {
  const payload = { ...legacy }
  delete payload.slug
  const response = await body(await api.POST(request({ ...payload, publicLinkMode: 'numeric', sharedDomain: 'honghotngay228.site' })))
  assert.equal(response.status, 201)
  assert.equal(response.data.items[0].slug, 'p7-50000')
  assert.equal(response.data.items[0].publicUrl, 'https://honghotngay228.site/p7/50000')
  assert.equal(Object.hasOwn(state.calls[0], 'publicLinkMode'), false)
})
scenario('legacy clients and standard creates retain explicit slugs; invalid opt-ins fail before writes', async () => {
  assert.equal((await create()).data.items[0].slug, legacy.slug)
  assert.equal((await create({ slug: 'standard', telegramSettings: { ...telegram, enabled: false } })).data.items[0].slug, 'standard')
  const before = state.rows.size
  for (const patch of [{ slug: undefined }, { publicLinkMode: 'other' }, { publicLinkMode: 'numeric', telegramSettings: { ...telegram, enabled: false } }]) assert.equal((await create(patch)).status, 400)
  assert.equal(state.rows.size, before)
})
scenario('numeric bulk variants allocate independently and snapshot defaults only once', async () => {
  const response = await create({ publicLinkMode: 'numeric', telegramSettings: undefined, popupIds: ['p1', 'p2', 'p1'] })
  assert.equal(response.status, 201)
  assert.deepEqual(response.data.items.map(post => post.slug), ['p7-50000', 'p7-50001'])
  assert.equal(state.defaultsRead, 1)
  for (const post of response.data.items) assert.deepEqual(post.telegramSettings, telegram)
})
scenario('precheck skips a globally occupied code from another owner', async () => {
  state.rows.set('other', { ...legacy, id: 'other', userId: 'different-owner', slug: 'p7-50000' })
  state.codes = [50000, 50001]
  assert.equal((await create({ publicLinkMode: 'numeric' })).data.items[0].slug, 'p7-50001')
  assert.equal(state.rows.get('other').userId, 'different-owner')
})
scenario('P2002 race rolls back complete batch, retries transaction and keeps snapshot', async () => {
  state.failCreate = 2
  const response = await create({ publicLinkMode: 'numeric', telegramSettings: undefined, popupIds: ['p1', 'p2'] })
  assert.equal(response.status, 201)
  assert.equal(state.transactions, 2)
  assert.equal(state.defaultsRead, 1)
  assert.equal(state.rows.size, 2)
  assert.deepEqual([...state.rows.values()].map(post => post.slug), ['p7-50002', 'p7-50003'])
  assert([...state.rows.values()].every(post => JSON.stringify(post.telegramSettings) === JSON.stringify(telegram)))
})
scenario('occupied-code and racing-write exhaustion are bounded and leave no partial batch', async () => {
  state.rows.set('other', { slug: 'p7-50000' })
  state.codes = Array(16).fill(50000)
  assert.equal((await create({ publicLinkMode: 'numeric' })).status, 409)
  assert.equal(state.calls.length, 0)
  assert.equal(state.rows.size, 1)
  reset(); state.alwaysCollide = true
  assert.equal((await create({ publicLinkMode: 'numeric', telegramSettings: undefined })).status, 409)
  assert.equal(state.transactions, 16)
  assert.equal(state.defaultsRead, 1)
  assert.equal(state.rows.size, 0)
})
scenario('auth, popup ownership and invalid domain reject before code allocation/write', async () => {
  state.actor = null; assert.equal((await create({ publicLinkMode: 'numeric' })).status, 401)
  state.actor = { id: 'owner', isAdmin: false }; state.popupOwner = false
  assert.equal((await create({ publicLinkMode: 'numeric', popupIds: ['foreign'] })).status, 400)
  state.popupOwner = true
  assert.equal((await create({ publicLinkMode: 'numeric', domainId: 'foreign' })).status, 400)
  assert.equal(state.calls.length, 0); assert.equal(state.nextCode, 50000)
})
scenario('unrelated database failures are not retried and leave no partial numeric posts', async () => {
  state.createError = new Error('Fixture write unavailable')
  const response = await create({ publicLinkMode: 'numeric' })
  assert.equal(response.status, 400)
  assert.equal(state.transactions, 1)
  assert.equal(state.rows.size, 0)
})
scenario('GET and PUT serialize numeric URL without changing stored code or account snapshot', async () => {
  const post = (await create({ publicLinkMode: 'numeric', sharedDomain: 'honghotngay228.site' })).data.items[0]
  const listed = await body(await api.GET({ nextUrl: new URL('https://rutgonlink.site/api/posts') }))
  assert.equal(listed.data.items[0].publicUrl, post.publicUrl)
  const edited = await body(await item.PUT(request({ ...legacy, slug: post.slug, title: 'Edited', sharedDomain: 'honghotngay228.site', publicLinkMode: 'numeric' }), { params: Promise.resolve({ id: post.id }) }))
  assert.equal(edited.status, 200); assert.equal(edited.data.slug, post.slug); assert.equal(edited.data.publicUrl, post.publicUrl)
  assert.equal(state.nextCode, 50001)
})
scenario('duplicate numeric source gets a fresh numeric draft; legacy copy behavior remains', async () => {
  const post = (await create({ publicLinkMode: 'numeric' })).data.items[0]
  const copy = await body(await duplicate.POST(request({}), { params: Promise.resolve({ id: post.id }) }))
  assert.equal(copy.status, 201); assert.equal(copy.data.slug, 'p7-50001'); assert.equal(copy.data.publicUrl, 'https://rutgonlink.site/p7/50001'); assert.equal(copy.data.isPublished, false)
  assert.deepEqual(copy.data.telegramSettings, post.telegramSettings)
  const old = (await create()).data.items[0]
  const oldCopy = await body(await duplicate.POST(request({}), { params: Promise.resolve({ id: old.id }) }))
  assert.equal(oldCopy.data.slug, legacy.slug + '-copy'); assert.equal(oldCopy.data.publicUrl, 'https://rutgonlink.site/' + legacy.slug + '-copy')
})
scenario('numeric duplication retries a collision without changing source and enforces owner', async () => {
  const source = (await create({ publicLinkMode: 'numeric' })).data.items[0]
  state.failCreate = 2
  const copy = await body(await duplicate.POST(request({}), { params: Promise.resolve({ id: source.id }) }))
  assert.equal(copy.status, 201); assert.equal(copy.data.slug, 'p7-50002')
  assert.equal(state.rows.size, 2); assert.equal(state.rows.get(source.id).slug, source.slug)
  state.actor = { id: 'other', isAdmin: true }
  assert.equal((await duplicate.POST(request({}), { params: Promise.resolve({ id: source.id }) })).status, 404)
})
scenario('numeric route serves actual HTML and correct canonical only on chosen host', async () => {
  await create({ publicLinkMode: 'numeric', sharedDomain: 'honghotngay228.site' })
  const response = await visit('50000'); assert.equal(response.status, 200)
  const html = await response.text()
  assert(html.includes('href="https://honghotngay228.site/p7/50000"'))
  assert(html.includes('property="og:url" content="https://honghotngay228.site/p7/50000"'))
  for (const host of ['rutgonlink.site', 'phimngay.site', 'unknown.example.test']) assert.equal((await visit('50000', host)).status, 404)
  const row = [...state.rows.values()][0]
  row.isPublished = false; assert.equal((await visit('50000')).status, 404)
  row.isPublished = true; row.user.status = 'disabled'; assert.equal((await visit('50000')).status, 404)
  row.user.status = 'active'; row.user.deletedAt = new Date(); assert.equal((await visit('50000')).status, 404)
  assert.equal((await visit('99999')).status, 404)
  for (const code of ['foo', '1234', '01234']) assert.equal((await visit(code)).status, 404)
})
scenario('primary/custom domains, legacy numeric alias and React metadata remain consistent', async () => {
  const primary = (await create({ publicLinkMode: 'numeric' })).data.items[0]
  assert.equal((await visit('50000', 'rutgonlink.site')).status, 200)
  const custom = (await create({ publicLinkMode: 'numeric', domainId: 'custom' })).data.items[0]
  assert.equal(custom.publicUrl, 'https://custom.example.test/p7/50001')
  assert.equal((await visit('50001', 'custom.example.test')).status, 200)
  const customHttpReq = new NextRequest('http://127.0.0.1:3000/p7/50001?fbclid=test', {
    headers: { host: 'custom.example.test', 'user-agent': 'facebookexternalhit/1.1', 'cf-visitor': '{"scheme":"http"}' },
  })
  const customHttpRes = await numericRoute.GET(customHttpReq, { params: Promise.resolve({ code: '50001' }) })
  assert.equal(customHttpRes.status, 301)
  assert.equal(customHttpRes.headers.get('location'), 'https://custom.example.test/p7/50001?fbclid=test')
  const unknownHttpReq = new NextRequest('http://127.0.0.1:3000/p7/50001', {
    headers: { host: 'unknown.example.test', 'user-agent': 'facebookexternalhit/1.1', 'cf-visitor': '{"scheme":"http"}' },
  })
  const unknownHttpRes = await numericRoute.GET(unknownHttpReq, { params: Promise.resolve({ code: '50001' }) })
  assert.equal(unknownHttpRes.status, 404)
  assert.equal(unknownHttpRes.headers.get('location'), null)
  assert.equal((await visit('50001', 'rutgonlink.site')).status, 404)
  const req = new NextRequest(`https://rutgonlink.site/${primary.slug}`, { headers: { host: 'rutgonlink.site', 'user-agent': 'Mozilla/5.0' } })
  assert.equal((await slugRoute.GET(req, { params: Promise.resolve({ shortCode: primary.slug }) })).status, 200)
  const metadata = await reactPage.generateMetadata({ params: Promise.resolve({ slug: primary.slug }) })
  assert.equal(metadata.alternates.canonical, primary.publicUrl)
  assert.equal(custom.slug, 'p7-50001')
})
scenario('direct wrapper allocates numeric /p7 link without article body, requires popup, and renders minimal card', async () => {
  const missingPopup = await api.POST(request({ title: 'Ưu đãi hôm nay', content: '', contentFormat: 'rich', isDirectWrapper: true, publicLinkMode: 'numeric', popupIds: [], sharedDomain: 'ca33newss.xyz', isPublished: true }))
  assert.equal(missingPopup.status, 400)
  const created = await body(await api.POST(request({ title: 'Ưu đãi hôm nay', content: '', contentFormat: 'rich', isDirectWrapper: true, publicLinkMode: 'numeric', popupIds: ['p1'], sharedDomain: 'ca33newss.xyz', isPublished: true })))
  assert.equal(created.status, 201)
  const post = created.data.items[0]
  assert.equal(post.slug, 'p7-50000')
  assert.equal(post.publicUrl, 'https://ca33newss.xyz/p7/50000')
  assert.equal(post.isDirectWrapper, true)
  assert.equal(post.telegramSettings.enabled, false)
  const res = await visit('50000', 'ca33newss.xyz')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert(html.includes('data-direct-wrapper=""'))
  assert(!html.includes('class="telegram-post"'))
  assert(html.includes('https://mesale.vn'))
  const copied = await body(await duplicate.POST(request({}), { params: Promise.resolve({ id: post.id }) }))
  assert.equal(copied.status, 201)
  assert.equal(copied.data.isDirectWrapper, true)
  assert.equal(copied.data.slug, 'p7-50001')
})
scenario('admin-only global post fallback routes missing /p7/<code> and /posts/<slug> to Admin target or 302 external URL without loops', async () => {
  await create({ title: 'User post', publicLinkMode: 'numeric', sharedDomain: 'honghotngay228.site' })
  state.actor = { id: 'admin-id', isAdmin: true }
  const adminPost = (await create({ title: 'Admin target post', publicLinkMode: 'numeric', sharedDomain: 'ca33newss.xyz' })).data.items[0]

  assert.equal((await adminFallbackApi.GET()).status, 403, 'Non-admin cannot read fallback setting')
  assert.equal((await adminFallbackApi.PUT(request({ enabled: true, targetUrl: adminPost.publicUrl }))).status, 403, 'Non-admin cannot write fallback setting')
  assert.equal((await visit('99999', 'ca33newss.xyz')).status, 404, 'Disabled by default')

  state.adminContext = { id: 'admin-id', email: 'admin@example.test', role: 'owner', permissions: ['system.read', 'system.write'] }
  assert.equal((await adminFallbackApi.PUT(request({ enabled: true, targetUrl: '' }))).status, 400, 'Reject empty URL when enabled')
  assert.equal((await adminFallbackApi.PUT(request({ enabled: true, targetUrl: '/p7/88888' }))).status, 400, 'Reject non-existent internal /p7 target')

  const savedInternal = await body(await adminFallbackApi.PUT(request({ enabled: true, targetUrl: '/p7/50001' })))
  assert.equal(savedInternal.status, 200)
  assert.equal(savedInternal.data.enabled, true)
  assert.equal(savedInternal.data.targetUrl, 'https://ca33newss.xyz/p7/50001')
  assert.equal(savedInternal.data.inspection.mode, 'post')

  // Missing /p7/<code> across any valid system domain renders Admin's post in-place with replaceState.
  for (const host of ['ca33newss.xyz', 'honghotngay228.site', 'rutgonlink.site']) {
    const res = await visit('99999', host)
    assert.equal(res.status, 200)
    const html = await res.text()
    assert(html.includes('Admin target post'))
    assert(html.includes(`href="https://${host}/p7/50001"`))
    assert(html.includes('window.history.replaceState(null,"","/p7/50001"'))
  }
  assert.equal((await visit('99999', 'unknown.example.test')).status, 404, 'Unknown hosts stay 404')

  // Missing /posts/<slug> also renders Admin's post and metadata.
  const aliasMeta = await reactPage.generateMetadata({ params: Promise.resolve({ slug: 'deleted-article' }) })
  assert.equal(aliasMeta.title.absolute, 'Admin target post')
  const aliasHtml = renderToStaticMarkup(await reactPage.default({ params: Promise.resolve({ slug: 'deleted-article' }) }))
  assert(aliasHtml.includes('Video fixture'))
  assert(aliasHtml.includes('window.history.replaceState(null,"","/p7/50001"'))

  // If Admin's target post is later unpublished, missing links return 404 instead of looping.
  state.rows.get(adminPost.id).isPublished = false
  assert.equal((await visit('99999', 'ca33newss.xyz')).status, 404)
  assert.equal((await visit('50001', 'ca33newss.xyz')).status, 404)

  // External target URL issues a no-store 302 redirect on /p7/<code> and Next redirect on /posts/<slug>.
  const savedExternal = await body(await adminFallbackApi.PUT(request({ enabled: true, targetUrl: 'https://shopee.vn/deal-chung' })))
  assert.equal(savedExternal.status, 200)
  assert.equal(savedExternal.data.inspection.mode, 'redirect')
  const extRes = await visit('99999', 'ca33newss.xyz')
  assert.equal(extRes.status, 302)
  assert.equal(extRes.headers.get('location'), 'https://shopee.vn/deal-chung')
  assert.match(extRes.headers.get('cache-control') || '', /no-store/)
  await assert.rejects(
    () => reactPage.default({ params: Promise.resolve({ slug: 'deleted-article' }) }),
    error => error.redirectUrl === 'https://shopee.vn/deal-chung',
  )

  const disabled = await body(await adminFallbackApi.PUT(request({ enabled: false, targetUrl: 'https://shopee.vn/deal-chung' })))
  assert.equal(disabled.data.enabled, false)
  assert.equal((await visit('99999', 'ca33newss.xyz')).status, 404)
  assert.equal(state.audits.length, 3)
})

scenario('Tranco Top-1M booster warms honghotngay228.site by default for real browsers, skips self-pings and Facebook crawlers, and supports Admin updates', async () => {
  await create({ title: 'Active ca33 post', publicLinkMode: 'numeric', sharedDomain: 'ca33newss.xyz' })
  await create({ title: 'Active honghot post', publicLinkMode: 'numeric', sharedDomain: 'honghotngay228.site' })

  assert.equal((await adminTrancoApi.GET()).status, 403)
  assert.equal((await adminTrancoApi.PUT(request({ enabled: true, domains: ['honghotngay228.site'] }))).status, 403)

  // Real mobile/desktop visitor on ca33newss.xyz receives dns-prefetch, preconnect, and /t.gif beacon for honghotngay228.site.
  const browserRes = await visit('50000', 'ca33newss.xyz')
  assert.equal(browserRes.status, 200)
  const browserHtml = await browserRes.text()
  assert(browserHtml.includes('rel="dns-prefetch" href="//honghotngay228.site"'))
  assert(browserHtml.includes('rel="preconnect" href="https://honghotngay228.site" crossorigin'))
  assert(browserHtml.includes('https://honghotngay228.site/t.gif'))

  // Self-ping suppression: visiting honghotngay228.site itself does not emit cross-domain hints for honghotngay228.site.
  const selfHtml = await (await visit('50001', 'honghotngay228.site')).text()
  assert(!selfHtml.includes('https://honghotngay228.site/t.gif'))
  assert(!selfHtml.includes('rel="dns-prefetch" href="//honghotngay228.site"'))

  // Facebook/Meta crawlers on ca33newss.xyz must never see honghotngay228.site or any script/preconnect hint.
  for (const ua of ['facebookexternalhit/1.1', 'meta-externalagent/1.1']) {
    const crawlerReq = new NextRequest('https://ca33newss.xyz/p7/50000', { headers: { host: 'ca33newss.xyz', 'user-agent': ua } })
    const crawlerHtml = await (await numericRoute.GET(crawlerReq, { params: Promise.resolve({ code: '50000' }) })).text()
    assert(!crawlerHtml.includes('honghotngay228.site'))
    assert(!crawlerHtml.includes('dns-prefetch'))
    assert(!crawlerHtml.includes('<script>'))
  }

  // Admin can add external domains (mesale.vn -> /favicon.ico) or pause boosting.
  state.adminContext = { id: 'admin-id', email: 'admin@example.test', role: 'owner', permissions: ['system.read', 'system.write'] }
  const initial = await body(await adminTrancoApi.GET())
  assert.deepEqual(initial.data.domains, ['honghotngay228.site'])
  const updated = await body(await adminTrancoApi.PUT(request({ enabled: true, domains: ['https://honghotngay228.site/p7/1', 'mesale.vn'] })))
  assert.equal(updated.status, 200)
  assert.deepEqual(updated.data.domains, ['honghotngay228.site', 'mesale.vn'])
  const multiHtml = await (await visit('50000', 'ca33newss.xyz')).text()
  assert(multiHtml.includes('https://honghotngay228.site/t.gif'))
  assert(multiHtml.includes('https://mesale.vn/favicon.ico'))

  const paused = await body(await adminTrancoApi.PUT(request({ enabled: false, domains: ['honghotngay228.site'] })))
  assert.equal(paused.data.enabled, false)
  const pausedHtml = await (await visit('50000', 'ca33newss.xyz')).text()
  assert(!pausedHtml.includes('honghotngay228.site'))
})

scenario('Admin default post domain setting defaults to ca33newss.xyz and propagates to member /api/posts/options', async () => {
  assert.equal((await adminDefaultDomainApi.GET()).status, 403)
  assert.equal((await adminDefaultDomainApi.PUT(request({ defaultDomain: 'honghotngay228.site' }))).status, 403)

  const initialMemberOptions = await body(await postOptionsApi.GET())
  assert.equal(initialMemberOptions.status, 200)
  assert.equal(initialMemberOptions.data.defaultPostDomain, 'ca33newss.xyz')

  state.adminContext = { id: 'admin-id', email: 'admin@example.test', role: 'owner', permissions: ['domains.read', 'domains.write'] }
  assert.equal((await adminDefaultDomainApi.PUT(request({ defaultDomain: 'outside-unlisted.example' }))).status, 400)

  const updated = await body(await adminDefaultDomainApi.PUT(request({ defaultDomain: 'honghotngay228.site' })))
  assert.equal(updated.status, 200)
  assert.equal(updated.data.defaultDomain, 'honghotngay228.site')

  const memberOptionsAfter = await body(await postOptionsApi.GET())
  assert.equal(memberOptionsAfter.data.defaultPostDomain, 'honghotngay228.site')
  assert.equal(state.audits.length, 1)
})

;(async () => {
  for (const { name, run } of tasks) { reset(); await run(); console.log(`PASS ${name}`) }
  console.log(`RESULT=PASS numeric-post-links=${tasks.length}`)
})().catch(error => { console.error(error); process.exitCode = 1 })
