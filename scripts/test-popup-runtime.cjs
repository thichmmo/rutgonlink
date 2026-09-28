/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// Execute the rendered inline script and the real React component against a deterministic DOM.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const React = require('react')
const { createRoot } = require('react-dom/client')

const sourceRoot = path.resolve(process.env.POPUP_TEST_ROOT || '.')
const baseline = process.argv.includes('--baseline')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const filePath = fs.existsSync(path.join(sourceRoot, file)) ? path.join(sourceRoot, file) : path.join(process.cwd(), file)
  let source = fs.readFileSync(filePath, 'utf8')
  if (file === 'app/[shortCode]/route.ts') source += '\nexports.buildManagedPostPage = buildManagedPostPage;'
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const localRequire = id => {
    if (id.startsWith('@/lib/')) {
      if (['popup-settings', 'popup-link', 'content-management', 'intermediate-image'].includes(id.slice(6))) return load(id.slice(2) + '.ts')
      return {}
    }
    if (id === 'next/server' || id === 'next-auth') return {}
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const facebookIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) [FBAN/FBIOS;FBAV/528]'
const safariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Safari/604.1'
const android = 'Mozilla/5.0 (Linux; Android 14) Chrome/140 [FBAN/FB4A]'
const desktop = 'Mozilla/5.0 (Windows NT 10.0) Chrome/140'
const product = 'https://www.tiktok.com/view/product/1729605979383696179?checksum=keep%2Fraw&encode_params=A+B%3D%3D&trackParams=%7B%22affiliate%22%3A%22original%22%7D'
const shopee = 'https://shopee.vn/product/123/456?affiliate=original'
const { defaultPopupSettings, getPopupStep, updateTikTokPopupUrl } = load('lib/popup-settings.ts')
const { normalizeSettings } = load('lib/content-management.ts')
const buildPage = load('app/[shortCode]/route.ts').buildManagedPostPage
const PostPopup = load('app/posts/[slug]/PostPopup.tsx').default
global.IS_REACT_ACT_ENVIRONMENT = true

async function mount(kind, options = {}) {
  const dom = new JSDOM('<!doctype html><html><body><main>Article</main><div id="root"></div></body></html>', {
    url: 'https://fixture.example/post', pretendToBeVisual: true,
  })
  const doc = dom.window.document
  let now = options.now || 1_000_000
  let timerId = 0
  let visibility = 'visible'
  const timers = new Map()
  const calls = []
  const storage = { session: new Map(options.session || []), local: new Map(options.local || []) }
  let cookie = options.cookie || ''
  const state = () => {
    const overlay = doc.querySelector(kind === 'route' ? '.managed-popup' : '[role="dialog"]')
    return !overlay ? 'ARTICLE' : overlay.textContent.includes('TikTok') ? 'TikTok' : 'Shopee'
  }
  const storageApi = name => ({
    getItem(key) { if (options[name] === false) throw new Error('Storage denied'); return storage[name].get(key) ?? null },
    setItem(key, value) { if (options[name] === false) throw new Error('Storage denied'); storage[name].set(key, value) },
    removeItem(key) { if (options[name] === false) throw new Error('Storage denied'); storage[name].delete(key) },
  })
  Object.defineProperty(doc, 'visibilityState', { get: () => visibility })
  Object.defineProperty(doc, 'cookie', {
    get() { if (options.cookies === false) throw new Error('Cookies denied'); return cookie },
    set(value) {
      if (options.cookies === false) throw new Error('Cookies denied')
      cookie = value.includes('Max-Age=0;') ? '' : value.split(';')[0]
    },
  })
  const schedule = (fn, ms, interval) => {
    const id = ++timerId
    timers.set(id, { fn, due: now + ms, interval })
    return id
  }
  const overrides = {
    sessionStorage: storageApi('session'), localStorage: storageApi('local'),
    setTimeout: (fn, ms) => schedule(fn, ms || 0, 0), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: id => timers.delete(id),
    location: { replace(url) {
      calls.push({ mode: 'same-tab', url, state: state(), session: [...storage.session] })
      if (options.replaceThrows) throw new Error('Navigation failed')
    } },
    open(url, target) {
      calls.push({ mode: 'new-tab', url, target, state: state(), session: [...storage.session] })
      if (options.handle === 'throw') throw new Error('Navigation failed')
      return options.handle === 'null' ? null : { opener: null }
    },
  }
  const win = new Proxy(dom.window, { get(target, prop) { return prop in overrides ? overrides[prop] : Reflect.get(target, prop) } })
  const realNow = Date.now
  Date.now = () => now
  global.window = win
  global.document = doc
  global.HTMLElement = dom.window.HTMLElement
  const settings = defaultPopupSettings(shopee, product)
  settings.shopee.delaySeconds = options.firstDelay || 0
  settings.tiktok.delaySeconds = options.secondDelay || 0
  if (options.iosUrl) settings.tiktok.iosUrl = options.iosUrl
  const popup = { isActive: options.active !== false, updatedAt: '2026-09-27T00:00:00.000Z', imageUrl: null, firstUrl: shopee, secondUrl: product, settings }
  const ua = options.ua || facebookIos
  let root
  async function tick(ms = 0) {
    await React.act(async () => {
      const until = now + ms
      let count = 0
      while (true) {
        const item = [...timers.entries()].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0]
        if (!item) break
        if (++count > 1000) throw new Error('Timer loop')
        const [id, timer] = item
        now = timer.due
        if (timer.interval) timer.due += timer.interval
        else timers.delete(id)
        timer.fn()
      }
      now = until
    })
  }
  if (kind === 'route') {
    const html = buildPage({ id: 'post1', slug: 'post', title: 'Fixture', content: 'Article', contentFormat: 'plain',
      user: { managedContentBlocks: [] }, popup: { ...popup, updatedAt: new Date(popup.updatedAt) } }, 'fixture.example', ua)
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
    if (script) {
      new vm.Script(script).runInNewContext({ window: win, document: doc, navigator: { userAgent: ua },
        sessionStorage: overrides.sessionStorage, localStorage: overrides.localStorage, Date, URL })
    }
  } else {
    root = createRoot(doc.querySelector('#root'))
    await React.act(async () => root.render(React.createElement(PostPopup, { postId: 'post1', popup, userAgent: ua })))
    await tick()
  }
  const button = () => doc.querySelector(kind === 'route' ? '.managed-popup-open' : '[role="dialog"] button')
  const fire = async (target, type) => React.act(async () => target.dispatchEvent(new dom.window.Event(type)))
  return {
    state, calls, storage, button, doc, tick,
    cookie: () => cookie,
    async click(element = button()) { assert.ok(element, 'Popup button exists'); await React.act(async () => element.click()) },
    async away(ms = 0) { await fire(win, 'blur'); visibility = 'hidden'; await fire(doc, 'visibilitychange'); now += ms },
    async back() { visibility = 'visible'; await fire(doc, 'visibilitychange'); await fire(win, 'pageshow'); await fire(win, 'focus') },
    async focus() { await fire(win, 'focus') },
    async close() { if (root) await React.act(async () => root.unmount()); dom.window.close(); Date.now = realNow; delete global.window; delete global.document; delete global.HTMLElement },
  }
}

let passed = 0
async function scenario(name, fn) {
  await fn()
  passed++
  console.log('PASS ' + name)
}
async function using(kind, options, fn) {
  const h = await mount(kind, options)
  try { return await fn(h) } finally { await h.close() }
}

async function main() {
  if (baseline) {
    for (const kind of ['route', 'react']) {
      await using(kind, { session: false, local: false, cookies: false }, async h => {
        await h.click(); await h.away(); await h.back()
        assert.equal(h.state(), 'Shopee')
        console.log('BASELINE ' + kind + ' storage-denied-return=Shopee (bug reproduced)')
      })
    }
    assert.equal(getPopupStep(defaultPopupSettings(shopee, product), 1, facebookIos).url, product)
    console.log('BASELINE tiktok=product-web-url')
    return
  }

  const helper = load('lib/popup-link.ts')
  await scenario('OneLink preserves raw affiliate URL and tracking', async () => {
    const url = helper.buildTikTokOneLinkUrl(product)
    const deep = new URL(new URL(url).searchParams.get('af_dp'))
    assert.equal(deep.searchParams.get('params_url'), product)
    assert.equal(deep.searchParams.get('trackParams'), new URL(product).searchParams.get('trackParams'))
    assert.deepEqual(JSON.parse(deep.searchParams.get('requestParams')), { product_id: ['1729605979383696179'] })
    assert.equal(helper.buildTikTokOneLinkUrl(url), url)
    for (const value of ['https://vt.tiktok.com/short', 'https://tiktok.com.evil.test/view/product/1729605979383696179', 'javascript:alert(1)', 'https://www.tiktok.com/@creator/video/1729605979383696179', 'https://user:pass@www.tiktok.com/view/product/1729605979383696179']) assert.equal(helper.buildTikTokOneLinkUrl(value), value)
    assert.equal(helper.isTikTokOneLinkUrl('https://onelink.me.evil.test/'), false)
    assert.equal(helper.isTikTokOneLinkUrl('http://snssdk1180.onelink.me/BAuo'), false)
  })
  await scenario('Long OneLink validation and custom iOS URL preservation', async () => {
    const oneLink = 'https://snssdk1180.onelink.me/BAuo?af_dp=' + 'x'.repeat(3000)
    const settings = defaultPopupSettings(shopee, product)
    settings.tiktok.iosUrl = oneLink
    assert.equal(normalizeSettings(settings, shopee, product).tiktok.iosUrl, oneLink)
    assert.equal(updateTikTokPopupUrl(settings.tiktok, 'https://vt.tiktok.com/new').iosUrl, oneLink)
    settings.tiktok.iosUrl = 'javascript:alert(1)'
    assert.equal(normalizeSettings(settings, shopee, product).tiktok.iosUrl, product)
    settings.tiktok.iosUrl = oneLink + 'x'.repeat(6000)
    assert.equal(normalizeSettings(settings, shopee, product).tiktok.iosUrl, product)
  })
  for (const kind of ['route', 'react']) {
    for (const handle of ['handle', 'null']) await scenario(kind + ' storage-denied ' + handle + ' return', async () => {
      await using(kind, { handle, session: false, local: false, cookies: false }, async h => {
        assert.equal(h.state(), 'Shopee')
        await h.click()
        assert.equal(h.calls[0].state, 'TikTok', 'DOM advances before external navigation')
        assert.equal(h.calls[0].url, shopee)
        await h.away(); await h.back(); await h.focus(); await h.tick(1000)
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        await h.click()
        assert.equal(h.calls[1].mode, 'same-tab')
        assert.equal(new URL(h.calls[1].url).hostname, 'snssdk1180.onelink.me')
        assert.equal(h.calls[1].state, 'ARTICLE')
        await h.away(); await h.back()
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' mobile null handle without lifecycle events', async () => {
      await using(kind, { handle: 'null', session: false, local: false, cookies: false }, async h => {
        await h.click(); await h.tick(1000); await h.focus()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
      })
    })
    await scenario(kind + ' repeated click while launch is pending', async () => {
      await using(kind, { handle: 'null' }, async h => {
        await h.click(); await h.click(); assert.equal(h.calls.length, 1)
        await h.tick(1000); await h.click(); assert.equal(h.calls.length, 2)
      })
    })
    await scenario(kind + ' supplied OneLink and inactive popup', async () => {
      const oneLink = helper.buildTikTokOneLinkUrl(product)
      await using(kind, { iosUrl: oneLink }, async h => {
        await h.click(); await h.click()
        assert.equal(h.calls[1].url, oneLink)
        assert.equal(h.calls[1].mode, 'same-tab')
      })
      await using(kind, { active: false }, async h => assert.equal(h.state(), 'ARTICLE'))
    })
    await scenario(kind + ' cookie-only reload and completion', async () => {
      const cookie1 = await using(kind, { session: false, local: false }, async h => { await h.click(); return h.cookie() })
      assert.match(cookie1, /=1\|\d+$/)
      const cookie2 = await using(kind, { session: false, local: false, cookie: cookie1 }, async h => {
        assert.equal(h.state(), 'TikTok'); await h.click(); return h.cookie()
      })
      assert.match(cookie2, /=2\|\d+$/)
      await using(kind, { session: false, local: false, cookie: cookie2 }, async h => assert.equal(h.state(), 'ARTICLE'))
      await using(kind, { session: false, local: false, cookie: cookie2, now: 3_000_000 }, async h => assert.equal(h.state(), 'Shopee'))
    })
    await scenario(kind + ' completed local handoff reload', async () => {
      const local = await using(kind, { session: false, cookies: false }, async h => {
        await h.click(); await h.click(); return [...h.storage.local]
      })
      await using(kind, { session: false, cookies: false, local }, async h => assert.equal(h.state(), 'ARTICLE'))
    })
    await scenario(kind + ' desktop blocked popup and second-step throw', async () => {
      await using(kind, { ua: desktop, handle: 'null' }, async h => {
        await h.click(); await h.focus(); await h.tick(1000); assert.equal(h.state(), 'Shopee')
      })
      await using(kind, { ua: desktop, handle: 'throw', session: [['post-popup:post1:2026-09-27T00:00:00.000Z', '1']] }, async h => {
        assert.equal(h.state(), 'TikTok'); await h.click(); assert.equal(h.state(), 'TikTok')
      })
      await using(kind, { handle: 'throw' }, async h => { await h.click(); assert.equal(h.state(), 'Shopee') })
    })
    await scenario(kind + ' countdown survives background suspension', async () => {
      await using(kind, { handle: 'null', firstDelay: 1, secondDelay: 10 }, async h => {
        assert.equal(h.button().disabled, true); await h.click(); assert.equal(h.calls.length, 0)
        await h.tick(1000); await h.click(); await h.away(12_000); await h.back()
        assert.equal(h.state(), 'TikTok'); assert.equal(h.button().disabled, false)
        await h.focus(); assert.equal(h.button().disabled, false)
      })
    })
    await scenario(kind + ' Safari Android desktop navigation unchanged', async () => {
      for (const ua of [safariIos, android, desktop]) await using(kind, { ua }, async h => {
        await h.click(); await h.click()
        assert.deepEqual(h.calls.map(call => [call.mode, call.url]), [['new-tab', shopee], ['new-tab', product]])
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' same-tab exception restores the second popup', async () => {
      await using(kind, { replaceThrows: true }, async h => {
        await h.click(); await h.click(); assert.equal(h.state(), 'TikTok')
      })
    })
  }
  await scenario('root route and React alias share cookie handoff', async () => {
    const cookie = await using('route', { session: false, local: false }, async h => { await h.click(); return h.cookie() })
    await using('react', { session: false, local: false, cookie }, async h => assert.equal(h.state(), 'TikTok'))
  })
  console.log('RESULT=PASS scenarios=' + passed)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
