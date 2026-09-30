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
assert.ok(fs.existsSync(sourceRoot), 'POPUP_TEST_ROOT must point to an existing source snapshot')
const baseline = process.argv.includes('--baseline')
const timerBaseline = process.argv.includes('--timer-baseline')
const shortLinkBaseline = process.argv.includes('--shortlink-baseline')
const cooldownBaseline = process.argv.includes('--cooldown-baseline')
const deviceBaseline = process.argv.includes('--device-baseline')
const deviceCheck = process.argv.includes('--device-check')
const contextMenuBaseline = process.argv.includes('--contextmenu-baseline')
const contextMenuCheck = process.argv.includes('--contextmenu-check')
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
    if (id === '@/lib/popup-click-token') return { createPopupClickToken: () => 'fixture-popup-click-token' }
    if (id === '@/lib/popup-click-client') return load('lib/popup-click-client.ts')
    if (id.startsWith('@/lib/')) {
      if (['popup-settings', 'popup-link', 'popup-settings-server', 'tiktok-link', 'content-management', 'intermediate-image', 'site-config', 'video-embed', 'post-preview'].includes(id.slice(6))) return load(id.slice(2) + '.ts')
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
const shortTikTok = 'https://vt.tiktok.com/ZS9rPANpNhyeP-JpTZz/'
const { defaultPopupSettings, getPopupStep, popupAppliesToDevice, updateTikTokPopupUrl } = load('lib/popup-settings.ts')
const { normalizeSettings, sanitizeRichHtml } = load('lib/content-management.ts')
const prepareSettings = fs.existsSync(path.join(sourceRoot, 'lib/popup-settings-server.ts'))
  ? load('lib/popup-settings-server.ts').preparePopupSettingsForRequest
  : async settings => settings
const buildPage = load('app/[shortCode]/route.ts').buildManagedPostPage
const PostPopup = load('app/posts/[slug]/PostPopup.tsx').default
const DesktopDevToolsGuard = fs.existsSync(path.join(sourceRoot, 'app/posts/[slug]/DesktopDevToolsGuard.tsx'))
  ? load('app/posts/[slug]/DesktopDevToolsGuard.tsx').default
  : () => null
global.IS_REACT_ACT_ENVIRONMENT = true

async function mount(kind, options = {}) {
  const dom = new JSDOM('<!doctype html><html><body><main>Article</main><div id="root"></div></body></html>', {
    url: 'https://fixture.example/post', pretendToBeVisual: true,
  })
  const doc = dom.window.document
  let now = options.now ?? 1_000_000
  let timerId = 0
  let visibility = 'visible'
  const timers = new Map()
  const calls = []
  const clickEvents = []
  Object.defineProperty(dom.window.navigator, 'sendBeacon', { value: (url, body) => {
    clickEvents.push({ url, ...JSON.parse(body) })
    return true
  } })
  const storage = { session: new Map(options.session || []), local: new Map(options.local || []) }
  const storageReads = []
  const cookieJar = new Map(String(options.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=')
    return [value.slice(0, index), { value: value.slice(index + 1), expires: Infinity }]
  }))
  const cookieWrites = []
  const cookies = () => [...cookieJar].filter(([, item]) => item.expires > now).map(([key, item]) => `${key}=${item.value}`).join('; ')
  const state = () => {
    const overlay = doc.querySelector(kind === 'route' ? '.managed-popup' : '[role="dialog"]')
    return !overlay ? 'ARTICLE' : overlay.textContent.includes('TikTok') ? 'TikTok' : 'Shopee'
  }
  const storageApi = name => ({
    getItem(key) { storageReads.push([name, key]); if (options[name] === false) throw new Error('Storage denied'); return storage[name].get(key) ?? null },
    setItem(key, value) { if (options[name] === false) throw new Error('Storage denied'); storage[name].set(key, value) },
    removeItem(key) { if (options[name] === false) throw new Error('Storage denied'); storage[name].delete(key) },
  })
  Object.defineProperty(doc, 'visibilityState', { get: () => visibility })
  Object.defineProperty(doc, 'cookie', {
    get() { if (options.cookies === false) throw new Error('Cookies denied'); return cookies() },
    set(value) {
      if (options.cookies === false) throw new Error('Cookies denied')
      cookieWrites.push(value)
      const pair = value.split(';')[0]
      const index = pair.indexOf('=')
      const age = /Max-Age=(\d+)/i.exec(value)
      cookieJar.set(pair.slice(0, index), { value: pair.slice(index + 1), expires: age ? now + Number(age[1]) * 1000 : Infinity })
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
    innerWidth: options.innerWidth ?? 1024,
    outerWidth: options.outerWidth ?? 1024,
    innerHeight: options.innerHeight ?? 768,
    outerHeight: options.outerHeight ?? 768,
    location: { hostname: options.hostname || 'fixture.example', replace(url) {
      calls.push({ mode: url === 'https://mesale.vn' ? 'devtools-redirect' : 'same-tab', url, state: state(), session: [...storage.session] })
      if (options.replaceThrows) throw new Error('Navigation failed')
    } },
    open(url, target) {
      calls.push({ mode: 'new-tab', url, target, state: state(), session: [...storage.session] })
      if (options.handle === 'throw') throw new Error('Navigation failed')
      return options.handle === 'null' ? null : { opener: null }
    },
  }
  dom.window.HTMLAnchorElement.prototype.click = function clickAnchor() {
    calls.push({
      mode: 'anchor-new-tab',
      url: this.href,
      target: this.target,
      rel: this.rel,
      hidden: this.hidden,
      attached: this.isConnected,
      state: state(),
      session: [...storage.session],
    })
    if (options.anchorThrows) throw new Error('Navigation failed')
  }
  const win = new Proxy(dom.window, { get(target, prop) { return prop in overrides ? overrides[prop] : Reflect.get(target, prop) } })
  const realNow = Date.now
  Date.now = () => now
  global.window = win
  global.document = doc
  global.HTMLElement = dom.window.HTMLElement
  const settings = defaultPopupSettings(shopee, product)
  if (options.cooldownMinutes !== undefined) settings.cooldownMinutes = options.cooldownMinutes
  settings.shopee.delaySeconds = options.firstDelay || 0
  settings.tiktok.delaySeconds = options.secondDelay || 0
  if (options.iosUrl) settings.tiktok.iosUrl = options.iosUrl
  const popup = { id: 'popup1', isActive: options.active !== false, updatedAt: '2026-09-27T00:00:00.000Z', imageUrl: null, firstUrl: shopee, secondUrl: product, settings }
  const ua = options.ua ?? facebookIos
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
    const html = await buildPage({ id: 'post1', slug: 'post', title: 'Fixture', content: 'Article', contentFormat: 'plain',
      user: { managedContentBlocks: [] }, popup: options.noPopup ? null : { ...popup, updatedAt: new Date(popup.updatedAt) } }, 'fixture.example', ua)
    doc.body.className = /<body class="([^"]*)"/.exec(html)?.[1] || ''
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1])
    for (const script of scripts) {
      new vm.Script(script).runInNewContext({ window: win, document: doc, navigator: { userAgent: ua },
        sessionStorage: overrides.sessionStorage, localStorage: overrides.localStorage, Date, URL })
    }
  } else {
    if (popup.isActive) popup.settings = await prepareSettings(settings, ua)
    root = createRoot(doc.querySelector('#root'))
    await React.act(async () => root.render(React.createElement(React.Fragment, null,
      React.createElement(DesktopDevToolsGuard, { userAgent: ua }),
      options.noPopup ? null : React.createElement(PostPopup, { postId: 'post1', popup, userAgent: ua,
        tracking: { postId: 'post1', popupId: 'popup1', token: 'fixture-popup-click-token' } }),
    )))
    await tick()
  }
  const button = () => doc.querySelector(kind === 'route' ? '.managed-popup-open' : '[role="dialog"] button')
  const fire = async (target, type) => React.act(async () => target.dispatchEvent(new dom.window.Event(type)))
  return {
    state, calls, clickEvents, storage, storageReads, button, doc, tick, cookieWrites,
    cookie: cookies,
    snapshot: () => ({ now, session: [...storage.session], local: [...storage.local], cookie: cookies() }),
    async click(element = button()) { assert.ok(element, 'Popup button exists'); await React.act(async () => element.click()) },
    async keydown(key, modifiers = {}, flush = true) {
      const event = new dom.window.KeyboardEvent('keydown', { key, keyCode: key === 'F12' ? 123 : undefined, bubbles: true, cancelable: true, ...modifiers })
      await React.act(async () => win.dispatchEvent(event))
      if (flush) await tick()
      return event.defaultPrevented
    },
    async mouse(type, flush = true) {
      const event = new dom.window.MouseEvent(type, { button: type === 'contextmenu' ? 2 : 0, bubbles: true, cancelable: true })
      await React.act(async () => doc.querySelector('main').dispatchEvent(event))
      if (flush) await tick()
      return event.defaultPrevented
    },
    async resize() { await fire(win, 'resize') },
    async unmount() { if (root) { await React.act(async () => root.unmount()); root = null } },
    async away(ms = 0) { await fire(win, 'blur'); visibility = 'hidden'; await fire(doc, 'visibilitychange'); now += ms },
    async back() { visibility = 'visible'; await fire(doc, 'visibilitychange'); await fire(win, 'pageshow'); await fire(win, 'focus') },
    async blur() { await fire(win, 'blur') },
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

async function withFetch(handler, fn) {
  const original = global.fetch
  const calls = []
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    return handler(url, options)
  }
  try { return await fn(calls) } finally { global.fetch = original }
}

async function main() {
  if (timerBaseline) {
    for (const kind of ['route', 'react']) await using(kind, { firstDelay: 3, secondDelay: 2 }, async h => {
      assert.equal(h.doc.querySelector('[role="timer"]'), null)
      assert.equal(h.doc.querySelector('[role="progressbar"]'), null)
      console.log('BASELINE ' + kind + ' timer=absent progress=absent delay=3s')
    })
    console.log('RESULT=TIMER_BASELINE_CONFIRMED')
    return
  }

  if (contextMenuBaseline || contextMenuCheck) {
    for (const kind of ['route', 'react']) await using(kind, { ua: desktop }, async h => {
      const prevented = await h.mouse('contextmenu')
      console.log(`${kind} desktop=${h.state()} contextmenu.prevented=${prevented} redirect=${h.calls[0]?.url || 'none'}`)
      assert.equal(prevented, !contextMenuBaseline)
      assert.equal(h.calls.length, contextMenuBaseline ? 0 : 1)
      if (contextMenuCheck) assert.equal(h.calls[0].url, 'https://mesale.vn')
    })
    console.log(contextMenuBaseline ? 'RESULT=CONTEXTMENU_BASELINE_CONFIRMED' : 'RESULT=CONTEXTMENU_CHECK_PASS')
    return
  }
  if (deviceBaseline || deviceCheck) {
    for (const kind of ['route', 'react']) await using(kind, { ua: desktop }, async h => {
      assert.equal(h.state(), deviceBaseline ? 'Shopee' : 'ARTICLE')
      await h.keydown('F12')
      assert.equal(h.calls.length, deviceBaseline ? 0 : 1)
      if (deviceCheck) assert.equal(h.calls[0].url, 'https://mesale.vn')
      console.log(`${kind} desktop=${h.state()} F12=${h.calls[0]?.url || 'none'}`)
    })
    console.log(deviceBaseline ? 'RESULT=BASELINE_CONFIRMED' : 'RESULT=DEVICE_CHECK_PASS')
    return
  }
  if (cooldownBaseline) {
    for (const kind of ['route', 'react']) {
      const state = await using(kind, { cooldownMinutes: 0 }, async h => {
        await h.click(); await h.tick(1000); await h.click(); return h.snapshot()
      })
      await using(kind, { ...state, cooldownMinutes: 0 }, async h => {
        assert.equal(h.state(), 'ARTICLE')
        console.log('BASELINE ' + kind + ' cooldown=0 revisit=ARTICLE (bug)')
      })
      await using(kind, { ...state, cooldownMinutes: 0, now: state.now + 31 * 60_000 }, async h => {
        assert.equal(h.state(), 'ARTICLE')
        console.log('BASELINE ' + kind + ' session-completion-never-expires (bug)')
      })
    }
    console.log('RESULT=BASELINE_CONFIRMED')
    return
  }
  if (shortLinkBaseline) {
    for (const kind of ['route', 'react']) await using(kind, { iosUrl: shortTikTok }, async h => {
      await h.click(); await h.tick(1000); await h.click()
      assert.equal(h.calls[1].mode, 'new-tab')
      assert.equal(h.calls[1].url, shortTikTok)
      console.log('BASELINE ' + kind + ' TikTok=vt.tiktok.com mode=new-tab')
    })
    console.log('RESULT=BASELINE_CONFIRMED')
    return
  }
  if (baseline) {
    for (const kind of ['route', 'react']) {
      await using(kind, { handle: 'null' }, async h => {
        await h.click()
        assert.equal(h.calls[0].mode, 'new-tab')
        assert.equal(h.calls[0].target, '_blank')
        assert.equal(h.calls[0].state, 'TikTok')
        console.log('BASELINE ' + kind + ' shopee-open-mode=new-tab')
      })
    }
    assert.equal(getPopupStep(defaultPopupSettings(shopee, product), 0, facebookIos).openMode, 'new-tab')
    console.log('BASELINE shopee-open-mode=new-tab')
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
    assert.equal(helper.isTikTokShortUrl(shortTikTok), true)
    for (const url of ['https://vt.tiktok.com.evil.test/a', 'https://user:pass@vt.tiktok.com/a', 'https://vt.tiktok.com:444/a', 'http://vt.tiktok.com/a']) {
      assert.equal(helper.isTikTokShortUrl(url), false)
      assert.equal(helper.getPopupLinkOpenMode(url, 'TIKTOK', { userAgent: facebookIos }), 'new-tab')
    }
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
  await scenario('Server short-link resolution stops before product login redirects', async () => {
    const settings = defaultPopupSettings(shopee, shortTikTok + '?server=product')
    const saved = JSON.stringify(settings)
    await withFetch(() => new Response(null, { status: 302, headers: { location: product } }), async requests => {
      const result = await prepareSettings(settings, facebookIos)
      assert.equal(requests.length, 1)
      assert.equal(requests[0].options.redirect, 'manual')
      assert.ok(requests[0].options.signal instanceof AbortSignal)
      assert.equal(result.tiktok.iosUrl, helper.buildTikTokOneLinkUrl(product))
      assert.equal(result.tiktok.androidUrl, settings.tiktok.androidUrl)
      assert.equal(JSON.stringify(settings), saved, 'Request preparation must not rewrite saved settings')
    })
  })
  await scenario('Server short-link preparation leaves other devices and custom iOS URLs alone', async () => {
    await withFetch(() => { throw new Error('Unexpected request') }, async requests => {
      const settings = defaultPopupSettings(shopee, shortTikTok)
      for (const ua of [safariIos, android, desktop]) assert.equal(await prepareSettings(settings, ua), settings)
      for (const url of [product, helper.buildTikTokOneLinkUrl(product), 'https://example.com/offer']) {
        settings.tiktok.iosUrl = url
        assert.equal(await prepareSettings(settings, facebookIos), settings)
      }
      settings.tiktok.iosUrl = shortTikTok
      settings.tiktok.iosEnabled = false
      assert.equal(await prepareSettings(settings, facebookIos), settings)
      assert.equal(requests.length, 0)
    })
  })
  await scenario('Server short-link cache coalesces and expires without losing signed URLs', async () => {
    const settings = defaultPopupSettings(shopee, shortTikTok + '?server=cache')
    const realNow = Date.now
    let now = realNow()
    Date.now = () => now
    try {
      await withFetch(() => new Response(null, { status: 301, headers: { location: product } }), async requests => {
        const [first, second] = await Promise.all([prepareSettings(settings, facebookIos), prepareSettings(settings, facebookIos)])
        assert.equal(requests.length, 1)
        assert.equal(first.tiktok.iosUrl, second.tiktok.iosUrl)
        await prepareSettings(settings, facebookIos)
        assert.equal(requests.length, 1)
        now += 5 * 60_000 + 1
        await prepareSettings(settings, facebookIos)
        assert.equal(requests.length, 2)
      })
    } finally { Date.now = realNow }
  })
  await scenario('Failed or timed-out short lookups retry after a brief cache', async () => {
    const settings = defaultPopupSettings(shopee, shortTikTok + '?server=retry')
    const realNow = Date.now
    let now = realNow()
    let fail = true
    Date.now = () => now
    try {
      await withFetch(() => {
        if (fail) throw new DOMException('Timeout', 'TimeoutError')
        return new Response(null, { status: 301, headers: { location: product } })
      }, async requests => {
        assert.equal(await prepareSettings(settings, facebookIos), settings)
        fail = false
        assert.equal(await prepareSettings(settings, facebookIos), settings)
        assert.equal(requests.length, 1)
        now += 15_001
        assert.equal((await prepareSettings(settings, facebookIos)).tiktok.iosUrl, helper.buildTikTokOneLinkUrl(product))
        assert.equal(requests.length, 2)
      })
    } finally { Date.now = realNow }
  })
  await scenario('Server redirect validation and loop bounds keep original short links', async () => {
    const redirects = ['https://evil.test/product/123', 'http://www.tiktok.com/view/product/1729605979383696179',
      'https://user:pass@www.tiktok.com/view/product/1729605979383696179', 'https://www.tiktok.com:444/view/product/1729605979383696179']
    for (const [index, location] of redirects.entries()) {
      const settings = defaultPopupSettings(shopee, shortTikTok + '?server=unsafe' + index)
      await withFetch(() => new Response(null, { status: 301, headers: { location } }), async requests => {
        assert.equal(await prepareSettings(settings, facebookIos), settings)
        assert.equal(requests.length, 1)
      })
    }
    const settings = defaultPopupSettings(shopee, shortTikTok + '?server=loop')
    await withFetch(url => new Response(null, { status: 302, headers: { location: url } }), async requests => {
      assert.equal(await prepareSettings(settings, facebookIos), settings)
      assert.equal(requests.length, 11)
      assert.equal(new Set(requests.map(request => request.options.signal)).size, 1, 'One deadline covers the whole redirect chain')
    })
  })
  await scenario('Server resolves vm and relative redirects and ignores non-product targets', async () => {
    const settings = defaultPopupSettings(shopee, 'https://vm.tiktok.com/fixture/')
    let hop = 0
    await withFetch(() => new Response(null, { status: 302, headers: { location: hop++ ? product : '/next/' } }), async requests => {
      assert.equal((await prepareSettings(settings, facebookIos)).tiktok.iosUrl, helper.buildTikTokOneLinkUrl(product))
      assert.equal(requests[1].url, 'https://vm.tiktok.com/next/')
    })
    settings.tiktok.iosUrl = shortTikTok + '?server=video'
    await withFetch(url => url.includes('vt.tiktok.com')
      ? new Response(null, { status: 302, headers: { location: 'https://www.tiktok.com/@creator/video/1729605979383696179' } })
      : new Response(null, { status: 200 }), async () => {
      assert.equal(await prepareSettings(settings, facebookIos), settings)
    })
  })
  await scenario('popup applies only to mobile user agents', async () => {
    const settings = defaultPopupSettings(shopee, product)
    assert.equal(popupAppliesToDevice(settings, facebookIos), true)
    assert.equal(popupAppliesToDevice(settings, android), true)
    assert.equal(popupAppliesToDevice(settings, desktop), false)
    assert.equal(popupAppliesToDevice(settings, ''), false)
    for (const ua of ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140', 'facebookexternalhit/1.1']) {
      assert.equal(popupAppliesToDevice(settings, ua), false)
    }
    settings.tiktok.iosEnabled = false
    assert.equal(popupAppliesToDevice(settings, facebookIos), false)
    assert.equal(popupAppliesToDevice(settings, android), true)
    settings.shopee.androidEnabled = false
    assert.equal(popupAppliesToDevice(settings, android), false)
  })
  await scenario('managed post metadata uses a social image without inserting it into the article', async () => {
    const html = await buildPage({ id: 'post-meta', slug: 'meta', title: 'Preview title', excerpt: 'Preview description', previewImage: '/uploads/content/preview.jpg', isFakeVideo: false, content: 'Article', contentFormat: 'plain', user: { managedContentBlocks: [] }, popup: null }, 'custom.example', desktop)
    assert.match(html, /property="og:image" content="https?:\/\/[^\"]+\/api\/posts\/post-meta\/preview-image\?v=/)
    assert.match(html, /property="og:type" content="article"/)
    assert.match(html, /name="twitter:card" content="summary_large_image"/)
    assert.doesNotMatch(html.split('<body')[1], /\/api\/posts\/post-meta\/preview-image/)
  })
  await scenario('rich video sanitization repairs supported share URLs', async () => {
    const html = sanitizeRichHtml('<figure><iframe src="https://www.tiktok.com/@creator/video/1234567890123456789"></iframe><iframe src="https://evil.example/embed/1"></iframe></figure>')
    assert.match(html, /tiktok\.com\/player\/v1\/1234567890123456789/)
    assert.doesNotMatch(html, /evil\.example/)
  })
  for (const kind of ['route', 'react']) {
    await scenario(kind + ' records only ready popup clicks with post and popup identity', async () => {
      await using(kind, { firstDelay: 1, secondDelay: 1 }, async h => {
        assert.equal(h.clickEvents.length, 0, 'Rendering the article is not a popup click')
        await h.click()
        assert.equal(h.clickEvents.length, 0, 'Disabled countdown taps do not count')
        await h.tick(1000); await h.click(); await h.click()
        assert.equal(h.clickEvents.length, 1, 'Repeated taps during handoff do not count twice')
        await h.away(1500); await h.back(); await h.click()
        assert.deepEqual(h.clickEvents.map(event => event.platform), ['SHOPEE', 'TIKTOK'])
        for (const event of h.clickEvents) {
          assert.equal(event.url, '/api/popup-clicks')
          assert.equal(event.postId, 'post1')
          assert.equal(event.popupId, 'popup1')
          assert.equal(event.token, 'fixture-popup-click-token')
        }
        assert.notEqual(h.clickEvents[0].eventId, h.clickEvents[1].eventId)
        await h.away(); await h.back()
        assert.equal(h.clickEvents.length, 2, 'Returning from an app does not create another click')
      })
    })
    await scenario(kind + ' visible countdown stays in sync through both steps', async () => {
      await using(kind, { firstDelay: 3, secondDelay: 2 }, async h => {
        const timer = () => h.doc.querySelector('[role="timer"]')
        const bar = () => h.doc.querySelector('[role="progressbar"]')
        assert.equal(timer().textContent, 'Còn 3 giây')
        assert.equal(bar().getAttribute('aria-valuenow'), '0')
        assert.equal(bar().getAttribute('aria-valuemax'), '100')
        assert.equal(h.button().disabled, true)
        await h.click()
        assert.equal(h.calls.length, 0)
        await h.tick(1000)
        assert.equal(timer().textContent, 'Còn 2 giây')
        assert.equal(bar().getAttribute('aria-valuenow'), '33')
        if (kind === 'route') assert.equal(h.doc.querySelector('.managed-popup-head span').textContent, 'Sau 2s')
        await h.tick(2000)
        assert.equal(timer().textContent, 'Sẵn sàng')
        assert.equal(bar().getAttribute('aria-valuenow'), '100')
        assert.equal(h.button().disabled, false)
        await h.click()
        assert.equal(h.state(), 'TikTok')
        assert.equal(timer().textContent, 'Còn 2 giây')
        assert.equal(bar().getAttribute('aria-label'), 'Bộ đếm TikTok')
        await h.away(3000); await h.back()
        assert.equal(timer().textContent, 'Sẵn sàng')
        assert.equal(bar().getAttribute('aria-valuenow'), '100')
        assert.equal(h.button().disabled, false)
        await h.click()
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(timer(), null)
      })
    })
    await scenario(kind + ' zero delay is ready with valid progress range', async () => {
      await using(kind, { firstDelay: 0, secondDelay: 0 }, async h => {
        assert.equal(h.doc.querySelector('[role="timer"]').textContent, 'Sẵn sàng')
        assert.equal(h.doc.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '100')
        assert.equal(h.doc.querySelector('[role="progressbar"]').getAttribute('aria-valuemax'), '100')
        assert.equal(h.button().disabled, false)
      })
    })
    for (const handle of ['handle', 'null']) await scenario(kind + ' storage-denied ' + handle + ' return', async () => {
      await using(kind, { handle, session: false, local: false, cookies: false }, async h => {
        assert.equal(h.state(), 'Shopee')
        await h.click()
        assert.equal(h.calls[0].state, 'TikTok', 'DOM advances before external navigation')
        assert.equal(h.calls[0].url, shopee)
        assert.equal(h.calls[0].mode, 'anchor-new-tab')
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
      for (const ua of [facebookIos, safariIos, android]) await using(kind, { ua, handle: 'null', session: false, local: false, cookies: false }, async h => {
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
        await h.click(); await h.tick(1000); await h.click()
        assert.equal(h.calls[1].url, oneLink)
        assert.equal(h.calls[1].mode, 'same-tab')
      })
      await using(kind, { active: false }, async h => assert.equal(h.state(), 'ARTICLE'))
    })
    await scenario(kind + ' short TikTok resolves to OneLink before clicking', async () => {
      await withFetch(() => new Response(null, { status: 301, headers: { location: product } }), async requests => {
        await using(kind, { iosUrl: shortTikTok + '?runtime=' + kind }, async h => {
          assert.equal(requests.length, 1, 'Resolve on the server before the popup is ready')
          await h.click(); await h.blur(); await h.focus(); await h.click()
          assert.equal(requests.length, 1, 'Never await a lookup inside the app-launch click')
          assert.equal(h.calls[0].mode, 'anchor-new-tab', 'Shopee return fix stays active')
          assert.equal(h.calls[1].mode, 'same-tab')
          assert.equal(h.calls[1].url, helper.buildTikTokOneLinkUrl(product))
          assert.equal(h.calls[1].state, 'ARTICLE')
        })
      })
    })
    await scenario(kind + ' failed short lookup keeps original same-tab link', async () => {
      await withFetch(() => { throw new Error('Upstream offline') }, async () => {
        const url = shortTikTok + '?failed=' + kind
        await using(kind, { iosUrl: url }, async h => {
          await h.click(); await h.tick(1000); await h.click()
          assert.equal(h.calls[1].mode, 'same-tab')
          assert.equal(h.calls[1].url, url)
        })
      })
    })
    await scenario(kind + ' cookie-only reload and completion', async () => {
      const cookie1 = await using(kind, { session: false, local: false }, async h => { await h.click(); return h.cookie() })
      assert.match(cookie1, /=1\|\d+$/)
      const cookie2 = await using(kind, { session: false, local: false, cookie: cookie1 }, async h => {
        assert.equal(h.state(), 'TikTok'); await h.click(); return h.cookie()
      })
      assert.match(cookie2, /=2\|\d+\|1800000$/)
      await using(kind, { session: false, local: false, cookie: cookie2 }, async h => assert.equal(h.state(), 'ARTICLE'))
      await using(kind, { session: false, local: false, cookie: cookie2, now: 3_000_000 }, async h => assert.equal(h.state(), 'Shopee'))
    })
    await scenario(kind + ' zero cooldown shows popup on the next load', async () => {
      for (const only of [{}, { local: false, cookies: false }, { session: false, cookies: false }, { session: false, local: false }]) {
        const state = await using(kind, { ...only, cooldownMinutes: 0 }, async h => {
          await h.click(); await h.tick(1000); await h.click()
          await h.away(); await h.back(); await h.focus()
          assert.equal(h.state(), 'ARTICLE', 'An app return must not start a popup loop')
          return h.snapshot()
        })
        assert.equal(state.session.length, 0)
        assert.equal(state.local.length, 0)
        assert.equal(state.cookie, '')
        await using(kind, { ...state, ...only, cooldownMinutes: 0 }, async h => assert.equal(h.state(), 'Shopee'))
      }
    })
    await scenario(kind + ' nonzero cooldown expires the completion marker', async () => {
      for (const cooldownMinutes of [1, 5, 60, 10080]) {
        for (const only of [{ local: false, cookies: false }, { session: false, cookies: false }, { session: false, local: false }]) {
          const state = await using(kind, { ...only, cooldownMinutes }, async h => {
            await h.click(); await h.tick(1000); await h.click()
            if (only.cookies !== false) assert.ok(h.cookieWrites.at(-1).includes(`Max-Age=${cooldownMinutes * 60};`))
            return h.snapshot()
          })
          const expiry = state.now + cooldownMinutes * 60_000
          const beforeExpiry = await using(kind, { ...state, ...only, cooldownMinutes, now: expiry - 1 }, async h => {
            assert.equal(h.state(), 'ARTICLE')
            await h.focus()
            return h.snapshot()
          })
          assert.deepEqual(beforeExpiry.session, state.session, 'Reading must not extend session expiry')
          assert.deepEqual(beforeExpiry.local, state.local, 'Reading must not extend local expiry')
          assert.equal(beforeExpiry.cookie, state.cookie, 'Reading must not extend cookie expiry')
          await using(kind, { ...beforeExpiry, ...only, cooldownMinutes, now: expiry }, async h => assert.equal(h.state(), 'Shopee'))
        }
      }
    })
    await scenario(kind + ' zero cooldown preserves Shopee return and unfinished reload', async () => {
      const state = await using(kind, { cooldownMinutes: 0, session: false, local: false }, async h => {
        await h.click(); await h.blur(); await h.focus()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        return h.snapshot()
      })
      await using(kind, { ...state, cooldownMinutes: 0, session: false, local: false }, async h => {
        assert.equal(h.state(), 'TikTok')
        await h.click()
        assert.equal(h.calls[0].mode, 'same-tab')
        assert.equal(new URL(h.calls[0].url).hostname, 'snssdk1180.onelink.me')
        assert.equal(h.state(), 'ARTICLE')
        await h.away(); await h.back()
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.cookie(), '')
      })
    })
    await scenario(kind + ' legacy and mismatched completion cannot override cooldown', async () => {
      const key = 'post-popup:post1:2026-09-27T00:00:00.000Z'
      const cookieKey = 'post_popup_post1_1790467200000'
      const legacy = { session: [[key, '2']], local: [[key, '2|2800000']], cookie: cookieKey + '=2|2800000' }
      for (const cooldownMinutes of [0, 5, 60]) await using(kind, { ...legacy, cooldownMinutes }, async h => assert.equal(h.state(), 'Shopee'))
      const state = await using(kind, { cooldownMinutes: 5 }, async h => {
        await h.click(); await h.tick(1000); await h.click(); return h.snapshot()
      })
      await using(kind, { ...state, cooldownMinutes: 0 }, async h => assert.equal(h.state(), 'Shopee'))
      await using(kind, { ...state, cooldownMinutes: 1 }, async h => assert.equal(h.state(), 'Shopee'))
      await using(kind, { cooldownMinutes: 0, session: [[key, '1']] }, async h => {
        assert.equal(h.state(), 'TikTok', 'An older in-flight handoff must still resume')
        assert.equal(h.storage.session.get(key), '1|2800000')
      })
    })
    await scenario(kind + ' first-step resume expires in session without extending on read', async () => {
      const state = await using(kind, { cooldownMinutes: 0, local: false, cookies: false }, async h => { await h.click(); return h.snapshot() })
      const expiry = state.now + 30 * 60_000
      const resumed = await using(kind, { ...state, cooldownMinutes: 0, local: false, cookies: false, now: expiry - 1 }, async h => {
        assert.equal(h.state(), 'TikTok'); return h.snapshot()
      })
      assert.deepEqual(resumed.session, state.session)
      await using(kind, { ...resumed, cooldownMinutes: 0, local: false, cookies: false, now: expiry }, async h => assert.equal(h.state(), 'Shopee'))
    })
    await scenario(kind + ' failed second navigation restores progress instead of cooldown', async () => {
      for (const cooldownMinutes of [0, 5]) {
        const state = await using(kind, { cooldownMinutes, replaceThrows: true }, async h => {
          await h.click(); await h.tick(1000); await h.click()
          assert.equal(h.state(), 'TikTok'); return h.snapshot()
        })
        await using(kind, { ...state, cooldownMinutes }, async h => assert.equal(h.state(), 'TikTok'))
      }
    })
    await scenario(kind + ' zero cooldown leaves unrelated cookies and storage intact', async () => {
      await using(kind, { cooldownMinutes: 0, session: [['unrelated', 'keep']], local: [['unrelated', 'keep']], cookie: 'unrelated=keep' }, async h => {
        await h.click(); await h.tick(1000); await h.click()
        assert.deepEqual([...h.storage.session], [['unrelated', 'keep']])
        assert.deepEqual([...h.storage.local], [['unrelated', 'keep']])
        assert.equal(h.cookie(), 'unrelated=keep')
      })
    })
    await scenario(kind + ' completed local handoff reload', async () => {
      const local = await using(kind, { session: false, cookies: false }, async h => {
        await h.click(); await h.tick(1000); await h.click(); return [...h.storage.local]
      })
      await using(kind, { session: false, cookies: false, local }, async h => assert.equal(h.state(), 'ARTICLE'))
    })
    await scenario(kind + ' desktop renders article without popup', async () => {
      const session = [['post-popup:post1:2026-09-27T00:00:00.000Z', '1']]
      await using(kind, { ua: desktop, handle: 'null', session }, async h => {
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.button(), null)
        assert.equal(h.doc.body.classList.contains('managed-locked'), false)
        await h.focus(); await h.away(); await h.back(); await h.tick(1500)
        assert.equal(h.calls.length, 0)
        assert.deepEqual(h.storageReads, [])
        assert.deepEqual([...h.storage.session], session, 'Desktop must not migrate mobile handoffs')
      })
    })
    await scenario(kind + ' desktop F12 redirects to mesale', async () => {
      await using(kind, { ua: desktop }, async h => {
        assert.equal(await h.keydown('F12'), true)
        await h.keydown('F12')
        assert.equal(h.calls.length, 1)
        assert.equal(h.calls[0].mode, 'devtools-redirect')
        assert.equal(h.calls[0].url, 'https://mesale.vn')
      })
    })
    await scenario(kind + ' desktop right-click redirects once and suppresses the menu', async () => {
      await using(kind, { ua: desktop }, async h => {
        assert.equal(await h.mouse('contextmenu', false), true)
        assert.equal(await h.mouse('contextmenu', false), true)
        assert.equal(await h.keydown('F12', {}, false), true)
        await h.tick()
        assert.deepEqual(h.calls.map(call => [call.mode, call.url]), [['devtools-redirect', 'https://mesale.vn']])
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' desktop right-click works without an active popup', async () => {
      for (const options of [{ noPopup: true }, { active: false }]) await using(kind, { ua: desktop, ...options }, async h => {
        assert.equal(await h.mouse('contextmenu'), true)
        assert.equal(h.calls.length, 1)
        assert.equal(h.calls[0].url, 'https://mesale.vn')
      })
    })
    await scenario(kind + ' normal desktop clicks do not redirect', async () => {
      await using(kind, { ua: desktop }, async h => {
        assert.equal(await h.mouse('click'), false)
        assert.equal(await h.mouse('dblclick'), false)
        assert.equal(h.calls.length, 0)
      })
    })
    await scenario(kind + ' mobile context menus preserve popup progress', async () => {
      for (const ua of [facebookIos, safariIos, android]) await using(kind, { ua }, async h => {
        assert.equal(await h.mouse('contextmenu'), false)
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.calls.length, 0)
        await h.click(); await h.tick(1000)
        assert.equal(await h.mouse('contextmenu'), false)
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.calls.filter(call => call.mode === 'devtools-redirect').length, 0)
      })
    })
    await scenario(kind + ' desktop resize does not false-positive redirect', async () => {
      await using(kind, { ua: desktop, outerWidth: 1280, innerWidth: 900 }, async h => {
        await h.resize(); await h.tick(1500)
        assert.equal(h.calls.length, 0)
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' mobile ignores DevTools dimensions', async () => {
      for (const ua of [facebookIos, safariIos, android]) await using(kind, { ua, outerWidth: 1280, innerWidth: 900 }, async h => {
        assert.equal(await h.keydown('F12'), false)
        assert.equal(await h.keydown('I', { ctrlKey: true, shiftKey: true }), false)
        assert.equal(h.calls.filter(call => call.url === 'https://mesale.vn').length, 0)
        assert.notEqual(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' desktop guard also runs without an active popup', async () => {
      for (const options of [{ noPopup: true }, { active: false }]) await using(kind, { ua: desktop, ...options }, async h => {
        assert.equal(h.state(), 'ARTICLE')
        await h.keydown('F12')
        assert.equal(h.calls.length, 1)
        assert.equal(h.calls[0].url, 'https://mesale.vn')
      })
    })
    await scenario(kind + ' developer shortcuts redirect but normal shortcuts do not', async () => {
      for (const modifiers of [{ ctrlKey: true, shiftKey: true }, { metaKey: true, altKey: true }]) {
        for (const key of ['i', 'J', 'c']) await using(kind, { ua: desktop }, async h => {
          await h.keydown(key, modifiers)
          assert.equal(h.calls.length, 1)
          assert.equal(h.calls[0].url, 'https://mesale.vn')
        })
      }
      await using(kind, { ua: desktop }, async h => {
        for (const key of ['c', 'a', 'v', 'f', 'p', 'l', 'r', 'u']) assert.equal(await h.keydown(key, { ctrlKey: true }), false)
        assert.equal(h.calls.length, 0)
      })
    })
    await scenario(kind + ' redirect destination host avoids a loop', async () => {
      for (const hostname of ['mesale.vn', 'www.mesale.vn']) await using(kind, { ua: desktop, hostname }, async h => {
        assert.equal(await h.keydown('F12'), false)
        assert.equal(await h.mouse('contextmenu'), false)
        assert.equal(h.calls.length, 0)
      })
    })
    await scenario(kind + ' countdown survives background suspension', async () => {
      await using(kind, { handle: 'null', firstDelay: 1, secondDelay: 10 }, async h => {
        assert.equal(h.button().disabled, true); await h.click(); assert.equal(h.calls.length, 0)
        await h.tick(1000); await h.click(); await h.away(12_000); await h.back()
        assert.equal(h.state(), 'TikTok'); assert.equal(h.button().disabled, false)
        await h.focus(); assert.equal(h.button().disabled, false)
      })
    })
    await scenario(kind + ' Safari and Android navigation unchanged', async () => {
      for (const ua of [safariIos, android]) await using(kind, { ua }, async h => {
        await h.click(); await h.click()
        assert.deepEqual(h.calls.map(call => [call.mode, call.url]), [['new-tab', shopee], ['new-tab', product]])
        assert.equal(h.state(), 'ARTICLE')
      })
      await using(kind, { ua: desktop }, async h => {
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.calls.length, 0)
      })
    })
    await scenario(kind + ' Facebook iPhone Shopee uses an attached link', async () => {
      await using(kind, { handle: 'throw' }, async h => {
        await h.click()
        assert.equal(h.calls[0].mode, 'anchor-new-tab')
        assert.equal(h.calls[0].target, '_blank')
        assert.equal(h.calls[0].rel, 'noopener noreferrer')
        assert.equal(h.calls[0].hidden, true)
        assert.equal(h.calls[0].attached, true)
        assert.equal(h.doc.querySelector('a[target="_blank"]'), null)
        assert.equal(h.state(), 'TikTok')
      })
    })
    await scenario(kind + ' attached link exception restores Shopee', async () => {
      await using(kind, { anchorThrows: true }, async h => {
        await h.click()
        assert.equal(h.calls[0].mode, 'anchor-new-tab')
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.doc.querySelector('a[target="_blank"]'), null)
        assert.equal(h.storage.session.get('post-popup:post1:2026-09-27T00:00:00.000Z'), undefined)
        assert.equal(h.storage.local.size, 0)
        assert.equal(h.cookie(), '')
        assert.equal(h.button().disabled, false)
      })
    })
    await scenario(kind + ' Shopee blur-focus return keeps TikTok ready', async () => {
      await using(kind, { handle: 'throw', session: false, local: false, cookies: false }, async h => {
        await h.click(); await h.click()
        assert.equal(h.calls.length, 1, 'A pending handoff ignores a second tap')
        // Facebook can emit blur/focus without changing document visibility.
        await h.blur(); await h.focus()
        assert.equal(h.doc.visibilityState, 'visible')
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        await h.click()
        assert.deepEqual(h.calls.map(call => call.mode), ['anchor-new-tab', 'same-tab'])
        assert.equal(h.calls[1].state, 'ARTICLE')
      })
    })
    await scenario(kind + ' same-tab exception restores the second popup', async () => {
      await using(kind, { replaceThrows: true }, async h => {
        await h.click(); await h.tick(1000); await h.click(); assert.equal(h.state(), 'TikTok')
      })
    })
  }
  await scenario('React guard removes its listener on unmount', async () => {
    await using('react', { ua: desktop }, async h => {
      await h.unmount()
      assert.equal(await h.keydown('F12'), false)
      assert.equal(await h.mouse('contextmenu'), false)
      assert.equal(h.calls.length, 0)
    })
  })
  await scenario('React guard cancels pending navigation on unmount', async () => {
    await using('react', { ua: desktop }, async h => {
      assert.equal(await h.keydown('F12', {}, false), true)
      assert.equal(h.calls.length, 0)
      await h.unmount(); await h.tick()
      assert.equal(h.calls.length, 0)
    })
  })
  await scenario('React guard cancels pending right-click navigation on unmount', async () => {
    await using('react', { ua: desktop }, async h => {
      assert.equal(await h.mouse('contextmenu', false), true)
      assert.equal(h.calls.length, 0)
      await h.unmount(); await h.tick()
      assert.equal(h.calls.length, 0)
    })
  })
  await scenario('root route and React alias share cookie handoff', async () => {
    const cookie = await using('route', { session: false, local: false }, async h => { await h.click(); return h.cookie() })
    await using('react', { session: false, local: false, cookie }, async h => assert.equal(h.state(), 'TikTok'))
  })
  await scenario('root route and React alias share configured completion expiry', async () => {
    const state = await using('route', { cooldownMinutes: 5, session: false, local: false }, async h => {
      await h.click(); await h.tick(1000); await h.click(); return h.snapshot()
    })
    await using('react', { ...state, cooldownMinutes: 5, session: false, local: false }, async h => assert.equal(h.state(), 'ARTICLE'))
    await using('react', { ...state, cooldownMinutes: 5, session: false, local: false, now: state.now + 300_000 }, async h => assert.equal(h.state(), 'Shopee'))
    await using('react', { ...state, cooldownMinutes: 0, session: false, local: false }, async h => assert.equal(h.state(), 'Shopee'))
  })
  console.log('RESULT=PASS scenarios=' + passed)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
