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
const { renderToStaticMarkup } = require('react-dom/server')

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
const preopenedBaseline = process.argv.includes('--preopened-baseline')
const preopenedCheck = process.argv.includes('--preopened-check')
const androidBaseline = process.argv.includes('--android-baseline')
const androidCheck = process.argv.includes('--android-check')
const androidPromptBaseline = process.argv.includes('--android-prompt-baseline')
const androidNativeBaseline = process.argv.includes('--android-native-baseline')
const androidNativeCheck = process.argv.includes('--android-native-check')
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
    if (file === 'app/posts/[slug]/page.tsx') {
      if (id === '@/lib/prisma') return { prisma: { managedPost: { findFirst: async () => postFixture } } }
      if (id === 'next/headers') return { headers: async () => new Headers({ 'user-agent': desktop, host: 'fixture.example' }) }
      if (id === 'next/navigation') return { notFound: () => { throw new Error('Fixture post not found') } }
      if (id === 'next/link' || id === '@/components/Navbar' || id === '@/components/Footer') return () => null
      if (id.startsWith('./')) return load('app/posts/[slug]/' + id.slice(2) + '.tsx')
    }
    if (id === '@/lib/popup-click-token') return { createPopupClickToken: () => 'fixture-popup-click-token' }
    if (id === '@/lib/popup-click-client') return load('lib/popup-click-client.ts')
    if (id.startsWith('@/lib/')) {
      if (['popup-settings', 'popup-link', 'popup-browser-gate', 'popup-settings-server', 'tiktok-link', 'content-management', 'popup-affiliate-url', 'intermediate-image', 'site-config', 'video-embed', 'post-preview', 'public-post-guard', 'telegram-settings', 'telegram-render', 'public-post-link'].includes(id.slice(6))) return load(id.slice(2) + '.ts')
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
const androidChrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'
const desktop = 'Mozilla/5.0 (Windows NT 10.0) Chrome/140'
const postFixture = { id: 'post1', slug: 'post', title: 'Fixture', content: 'Article', contentFormat: 'plain', createdAt: new Date('2026-10-01'), user: { managedContentBlocks: [] }, popup: null }
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
    url: options.currentHref || 'https://fixture.example/post', pretendToBeVisual: true,
  })
  const doc = dom.window.document
  const ua = options.ua ?? facebookIos
  const mobileUa = /iphone|ipad|ipod|android/i.test(ua)
  Object.defineProperties(dom.window.navigator, {
    userAgent: { value: ua },
    platform: { value: options.platform ?? (mobileUa ? (/android/i.test(ua) ? 'Linux armv8l' : 'iPhone') : 'Win32') },
    maxTouchPoints: { value: options.maxTouchPoints ?? (mobileUa ? 5 : 0) },
  })
  let now = options.now ?? 1_000_000
  let timerId = 0
  let visibility = options.visibility || 'visible'
  const timers = new Map()
  const calls = []
  const clickEvents = []
  Object.defineProperty(dom.window.navigator, 'sendBeacon', { value: (url, body) => {
    clickEvents.push({ url, ...JSON.parse(body) })
    return true
  } })
  const storage = { session: new Map(options.session || []), local: new Map(options.local || []) }
  const storageReads = []
  const storageWrites = []
  const cookieJar = new Map(String(options.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=')
    return [value.slice(0, index), { value: value.slice(index + 1), expires: Infinity }]
  }))
  const cookieWrites = []
  const cookies = () => [...cookieJar].filter(([, item]) => item.expires > now).map(([key, item]) => `${key}=${item.value}`).join('; ')
  const state = () => {
    if (doc.querySelector('[data-popup-browser-gate]')) return 'CHROME_GATE'
    const overlay = doc.querySelector(kind === 'route' ? '.managed-popup' : '[role="dialog"]')
    return !overlay ? 'ARTICLE' : overlay.textContent.includes('TikTok') ? 'TikTok' : 'Shopee'
  }
  const storageApi = name => ({
    getItem(key) { storageReads.push([name, key]); if (options[name] === false) throw new Error('Storage denied'); return storage[name].get(key) ?? null },
    setItem(key, value) { storageWrites.push([name, 'set', key, value]); if (options[name] === false) throw new Error('Storage denied'); storage[name].set(key, value) },
    removeItem(key) { storageWrites.push([name, 'remove', key]); if (options[name] === false) throw new Error('Storage denied'); storage[name].delete(key) },
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
    performance: { getEntriesByType: type => type === 'navigation' ? [{ type: options.navType || 'navigate' }] : [] },
    location: { href: dom.window.location.href, hostname: options.hostname || dom.window.location.hostname, replace(url) {
      calls.push({ mode: url === 'https://mesale.vn' ? 'devtools-redirect' : 'same-tab', url, state: state(), session: [...storage.session] })
      if (options.replaceThrows) throw new Error('Navigation failed')
    } },
    open(url, target) {
      calls.push({ mode: 'new-tab', url, target, state: state(), session: [...storage.session] })
      if (options.handle === 'throw') throw new Error('Navigation failed')
      return options.handle === 'null' ? null : { opener: null }
    },
  }
  Object.defineProperty(dom.window.HTMLAnchorElement.prototype, 'disabled', {
    get() { return this.getAttribute('aria-disabled') === 'true' },
    set(value) { this.setAttribute('aria-disabled', String(Boolean(value))) },
  })
  dom.window.HTMLAnchorElement.prototype.click = function clickAnchor() {
    const nativeAction = this.hasAttribute('data-popup-native-link')
    const browserGateAction = this.hasAttribute('data-popup-chrome-link')
    if (nativeAction || browserGateAction) {
      // Run the real handler, observing its default-action decision at the end of
      // propagation. Only this test listener cancels external JSDOM navigation.
      let allowed = false
      const stopNavigation = event => { allowed = !event.defaultPrevented; event.preventDefault() }
      dom.window.addEventListener('click', stopNavigation, { once: true })
      this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      dom.window.removeEventListener('click', stopNavigation)
      if (!allowed) return
    }
    calls.push({
      mode: this.target === '_self' ? 'anchor-same-tab' : 'anchor-new-tab',
      url: this.href,
      target: this.target,
      rel: this.rel,
      hidden: this.hidden,
      attached: this.isConnected,
      nativeAction,
      browserGateAction,
      state: state(),
      session: [...storage.session],
    })
    if (options.anchorThrows && !nativeAction) throw new Error('Navigation failed')
  }
  const win = new Proxy(dom.window, { get(target, prop) { return prop in overrides ? overrides[prop] : Reflect.get(target, prop) } })
  const realNow = Date.now
  Date.now = () => now
  global.window = win
  global.document = doc
  global.HTMLElement = dom.window.HTMLElement
  const settings = defaultPopupSettings(shopee, product)
  // Existing Facebook fixtures exercise affiliate sequencing independently of the opt-in browser gate.
  settings.forceChromeAndroid = options.forceChromeAndroid ?? false
  if (options.cooldownMinutes !== undefined) settings.cooldownMinutes = options.cooldownMinutes
  settings.shopee.delaySeconds = options.firstDelay || 0
  settings.tiktok.delaySeconds = options.secondDelay || 0
  if (options.iosUrl) settings.tiktok.iosUrl = options.iosUrl
  if (options.androidUrl !== undefined) settings.tiktok.androidUrl = options.androidUrl
  if (options.tiktokUrl !== undefined) settings.tiktok.url = options.tiktokUrl
  if (options.shopeeUrl) settings.shopee.url = options.shopeeUrl
  if (options.tiktokEnabled !== undefined) settings.tiktok.enabled = options.tiktokEnabled
  if (options.androidEnabled !== undefined) settings.tiktok.androidEnabled = options.androidEnabled
  if (options.androidLaunchUrl !== undefined) settings.tiktok.androidLaunchUrl = options.androidLaunchUrl
  const popup = { id: 'popup1', isActive: options.active !== false, updatedAt: '2026-09-27T00:00:00.000Z', imageUrl: null, firstUrl: shopee, secondUrl: options.tiktokUrl ?? product, settings }
  const preparationRequests = []
  // Spy on Android preparation: it must preserve the source without fetching a live affiliate URL.
  const prepareMount = async fn => {
    if (!/android/i.test(ua) || !/^https:\/\/(vt|vm)\.tiktok\.com\//.test(settings.tiktok.androidUrl)) return fn()
    return withFetch((url, requestOptions) => {
      preparationRequests.push({ url, options: requestOptions })
      if (options.androidLookupFails) throw new DOMException('Timeout', 'TimeoutError')
      return new Response(null, { status: 302, headers: { location: options.androidProduct || product } })
    }, fn)
  }
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
    const html = await prepareMount(() => buildPage({ id: 'post1', slug: 'post', title: 'Fixture', content: 'Article', contentFormat: 'plain',
      user: { managedContentBlocks: [] }, popup: options.noPopup ? null : { ...popup, updatedAt: new Date(popup.updatedAt) } }, 'fixture.example', ua))
    doc.body.className = /<body class="([^"]*)"/.exec(html)?.[1] || ''
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1])
    for (const script of scripts) {
      new vm.Script(script).runInNewContext({ window: win, document: doc, navigator: dom.window.navigator,
        sessionStorage: overrides.sessionStorage, localStorage: overrides.localStorage, Date, URL })
    }
  } else {
    if (popup.isActive) popup.settings = await prepareMount(() => prepareSettings(settings, ua))
    root = createRoot(doc.querySelector('#root'))
    await React.act(async () => root.render(React.createElement(React.Fragment, null,
      React.createElement(DesktopDevToolsGuard, { userAgent: ua }),
      options.noPopup ? null : React.createElement(PostPopup, { postId: 'post1', popup, userAgent: ua,
        tracking: { postId: 'post1', popupId: 'popup1', token: 'fixture-popup-click-token' } }),
    )))
    await tick()
  }
  const button = () => doc.querySelector(kind === 'route' ? '[data-popup-chrome-link], .managed-popup-open' : '[data-popup-chrome-link], [role="dialog"] [data-popup-native-link], [role="dialog"] button')
  const fire = async (target, type) => React.act(async () => target.dispatchEvent(new dom.window.Event(type)))
  return {
    state, calls, clickEvents, storage, storageReads, storageWrites, button, doc, tick, cookieWrites, preparationRequests,
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
    async resize(dimensions = {}) { Object.assign(overrides, dimensions); await fire(win, 'resize') },
    async unmount() { if (root) { await React.act(async () => root.unmount()); root = null } },
    timerCount: () => timers.size,
    async away(ms = 0) { await fire(win, 'blur'); visibility = 'hidden'; await fire(doc, 'visibilitychange'); now += ms },
    async back() { visibility = 'visible'; await fire(doc, 'visibilitychange'); await fire(win, 'pageshow'); await fire(win, 'focus') },
    async blur() { await fire(win, 'blur') },
    async focus() { await fire(win, 'focus') },
    async pagehide() { await fire(win, 'pagehide') },
    async pageshow() { await fire(win, 'pageshow') },
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

async function androidScenarios() {
  const helper = load('lib/popup-link.ts')
  const fallbackUrl = launchUrl => decodeURIComponent(/;S\.browser_fallback_url=([^;]+);/.exec(launchUrl)?.[1] || '')
  await scenario('Legacy Android native builder preserves the seven-field URI syntax only', async () => {
    const values = { biz_type: '0', enter_method: 'web', is_commerce: '1', need_mall: '1', needlaunchlog: '1', page_name: 'reflow_pdp', params_url: product }
    const expected = `intent://ec/pdp?${new URLSearchParams(values)}#Intent;scheme=snssdk1180;package=com.ss.android.ugc.trill;S.browser_fallback_url=${encodeURIComponent(shortTikTok)};end`
    assert.equal(helper.buildTikTokAndroidLaunchUrl(product, shortTikTok), expected)
    const native = new URL(expected.split('#Intent;')[0].replace(/^intent:/, 'snssdk1180:'))
    assert.equal(native.searchParams.get('params_url'), product)
    assert.equal(fallbackUrl(expected), shortTikTok)
    assert.equal(helper.buildAndroidPopupLaunchUrl(product, 'TIKTOK'), helper.buildTikTokAndroidLaunchUrl(product))
    assert.equal(helper.buildAndroidPopupLaunchUrl(shortTikTok, 'TIKTOK'), shortTikTok, 'An unresolved short link stays usable HTTPS, never a broken HTTPS intent')
    assert.equal(helper.buildAndroidPopupLaunchUrl(shopee, 'SHOPEE'), shopee, 'Shopee keeps its original HTTPS source')
  })
  await scenario('Legacy Android URI builder and raw Shopee preserve long affiliate URLs without truncation', async () => {
    const url = product + '&signed=' + 'A'.repeat(2100)
    assert.ok(url.length > 2048)
    assert.ok(url.length < 8192)
    const launchUrl = helper.buildTikTokAndroidLaunchUrl(url)
    assert.equal(fallbackUrl(launchUrl), url)
    assert.equal(new URL(launchUrl.split('#Intent;')[0]).searchParams.get('params_url'), url)
    const tooLong = product + '&signed=' + 'A+B%2F'.repeat(650)
    assert.equal(helper.buildTikTokAndroidLaunchUrl(tooLong), tooLong, 'Oversized derived links fall back instead of truncating source data')
    const shopeeUrl = shopee + '&signed=' + 'A+B%2F'.repeat(650)
    assert.equal(helper.buildAndroidPopupLaunchUrl(shopeeUrl, 'SHOPEE'), shopeeUrl)
  })
  await scenario('Android intent leaves unsupported and fragment-bearing URLs untouched', async () => {
    for (const [platform, url] of [
      ['SHOPEE', 'https://shopee.vn.evil.test/product/123/456'],
      ['SHOPEE', 'https://example.test/offer?source=shopee.vn'],
      ['SHOPEE', shopee + '#review'],
      ['SHOPEE', 'http://shopee.vn/product/123/456'],
      ['SHOPEE', 'https://user:pass@shopee.vn/product/123/456'],
      ['SHOPEE', 'https://shopee.vn:444/product/123/456'],
      ['TIKTOK', 'https://vt.tiktok.com.evil.test/short'],
      ['TIKTOK', 'https://example.test/offer?source=vt.tiktok.com'],
      ['TIKTOK', shortTikTok + '#video'],
      ['TIKTOK', 'javascript:alert(1)'],
      ['TIKTOK', product + '&invalid=\ud800'],
      ['TIKTOK', shopee],
      ['SHOPEE', shortTikTok],
    ]) assert.equal(helper.buildAndroidPopupLaunchUrl(url, platform), url)
  })
  await scenario('Android launch chooses its independent saved URL without changing iOS', async () => {
    const settings = defaultPopupSettings(shopee, product)
    settings.tiktok.androidUrl = shortTikTok
    settings.tiktok.iosUrl = 'https://snssdk1180.onelink.me/BAuo?af_dp=ios-only'
    const saved = JSON.stringify(settings)
    for (const ua of [android, androidChrome]) {
      const step = getPopupStep(settings, 1, ua)
      assert.equal(step.url, shortTikTok)
      assert.equal(step.launchUrl, shortTikTok)
      assert.equal(step.openMode, 'anchor-same-tab')
      assert.equal(getPopupStep(settings, 0, ua).launchUrl, shopee)
      assert.equal(getPopupStep(settings, 0, ua).openMode, 'anchor-new-tab')
    }
    const iosStep = getPopupStep(settings, 1, facebookIos)
    assert.equal(iosStep.url, settings.tiktok.iosUrl)
    assert.equal(iosStep.launchUrl, iosStep.url)
    assert.equal(iosStep.openMode, 'same-tab')
    assert.equal(JSON.stringify(settings), saved)
  })
  await scenario('Android preparation strips stale launch metadata without fetching or changing either source', async () => {
    const source = shortTikTok + "?token=a'b+A%2fB&repeat=1&repeat=2"
    for (const ua of [android, androidChrome]) {
      const settings = defaultPopupSettings(shopee, 'https://example.test/general-unused')
      settings.tiktok.androidUrl = source
      settings.tiktok.iosUrl = 'https://vt.tiktok.com/ios-must-not-be-read/'
      settings.tiktok.androidLaunchUrl = helper.buildTikTokAndroidLaunchUrl(product, source)
      const saved = JSON.stringify(settings)
      await withFetch(() => { throw new Error('Android preparation must not resolve either source') }, async requests => {
        const result = await prepareSettings(settings, ua)
        assert.equal(requests.length, 0)
        assert.equal(result.tiktok.androidUrl, source)
        assert.equal(result.tiktok.url, settings.tiktok.url)
        assert.equal(result.tiktok.iosUrl, settings.tiktok.iosUrl)
        assert.equal(result.tiktok.androidLaunchUrl, undefined)
        assert.equal(getPopupStep(result, 1, ua).url, source)
        assert.equal(getPopupStep(result, 1, ua).launchUrl, source)
        assert.equal(JSON.stringify(settings), saved, 'Preparation must not mutate persisted settings')
      })
    }
  })
  await scenario('Android source selection ignores valid and malicious legacy metadata and normalization drops it', async () => {
    const settings = defaultPopupSettings(shopee, shortTikTok)
    const valid = helper.buildTikTokAndroidLaunchUrl(product, shortTikTok)
    for (const value of [valid, valid.replace('com.ss.android.ugc.trill', 'evil.app'), 'javascript:alert(1)', valid + ';evil=1']) {
      settings.tiktok.androidLaunchUrl = value
      for (const ua of [android, androidChrome]) assert.equal(getPopupStep(settings, 1, ua).launchUrl, shortTikTok)
      assert.equal(normalizeSettings(settings, shopee, shortTikTok).tiktok.androidLaunchUrl, undefined)
    }
  })
  await scenario('Repeated and concurrent Android preparation never resolves short or signed product sources', async () => {
    const signed = product + '&signed=' + 'A+B%2f'.repeat(650)
    await withFetch(() => { throw new Error('Unexpected Android network request') }, async requests => {
      for (const source of [shortTikTok, signed]) {
        const settings = defaultPopupSettings(shopee, source)
        const saved = JSON.stringify(settings)
        const prepared = await Promise.all([prepareSettings(settings, android), prepareSettings(settings, androidChrome)])
        for (const result of prepared) {
          assert.equal(getPopupStep(result, 1, android).launchUrl, source)
          assert.equal(result.tiktok.androidLaunchUrl, undefined)
        }
        await prepareSettings(settings, android)
        settings.tiktok.androidEnabled = false
        await prepareSettings(settings, android)
        settings.tiktok.androidEnabled = true
        assert.equal(JSON.stringify(settings), saved)
      }
      assert.equal(requests.length, 0)
    })
  })
  const gateHelper = load('lib/popup-browser-gate.ts')
  await scenario('Chrome gate preserves the real article scheme, alias, signed query and fragment without a fallback', async () => {
    for (const href of [
      'https://alias.example/nam-tay?token=A+B%2f&repeat=1&repeat=2#section%23detail',
      'http://alias.example:8080/post?next=https%3A%2F%2Ffixture.example%2Fp#part#nested',
    ]) {
      const url = new URL(href)
      const expected = 'intent://' + url.href.slice(url.protocol.length + 2) + '#Intent;scheme=' + url.protocol.slice(0, -1) + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end'
      const launch = gateHelper.buildChromeBrowserLaunchUrl(href)
      assert.equal(launch, expected)
      assert.doesNotMatch(launch, /browser_fallback_url/)
      // AOSP Intent.parseUri finds the final # delimiter, retaining an earlier article hash in its data.
      const marker = launch.lastIndexOf('#Intent;')
      assert.equal(url.protocol + launch.slice('intent:'.length, marker), url.href)
    }
    for (const href of ['', '/relative', 'javascript:alert(1)', 'intent://host/post', 'https://user:pass@alias.example/post']) {
      assert.equal(gateHelper.buildChromeBrowserLaunchUrl(href), '')
    }
  })
  for (const kind of ['route', 'react']) {
    await scenario(kind + ' opt-in Android Facebook Chrome gate never starts or advances affiliate state', async () => {
      const marker = 'post-popup:post1:2026-09-27T00:00:00.000Z'
      const href = 'https://alternate.example/actual-slug?token=A+B%2f&repeat=1&repeat=2#part#nested'
      await using(kind, { ua: android, forceChromeAndroid: true, currentHref: href, firstDelay: 2, secondDelay: 7,
        session: [[marker, '1|999999999'], ['unrelated-session', 'keep']],
        local: [[marker, '2|999999999|1800000'], ['unrelated-local', 'keep']],
        cookie: 'unrelated_cookie=keep',
      }, async h => {
        const saved = { session: [...h.storage.session], local: [...h.storage.local], cookie: h.cookie() }
        const isolated = () => {
          assert.equal(h.state(), 'CHROME_GATE')
          assert.deepEqual({ session: [...h.storage.session], local: [...h.storage.local], cookie: h.cookie() }, saved)
          assert.deepEqual(h.storageReads, [])
          assert.deepEqual(h.storageWrites, [])
          assert.deepEqual(h.cookieWrites, [])
          assert.deepEqual(h.clickEvents, [])
          assert.equal(h.preparationRequests.length, 0)
          assert.equal(h.timerCount(), 0, 'Browser transfer must not start countdown or retry timers')
          assert.equal(h.doc.querySelector('[data-popup-native-link]'), null)
        }
        isolated()
        await h.tick(12000)
        assert.equal(h.calls.length, 0, 'No automatic browser transfer or affiliate launch')
        const anchor = h.button()
        assert.equal(anchor.tagName, 'A')
        assert.equal(anchor.isConnected, true)
        assert.equal(anchor.hidden, false)
        assert.equal(anchor.target, '_self')
        assert.equal(anchor.href, gateHelper.buildChromeBrowserLaunchUrl(href))
        assert.doesNotMatch(anchor.href, /browser_fallback_url/)
        await h.click(anchor)
        assert.equal(h.calls.length, 1)
        assert.equal(h.calls[0].browserGateAction, true)
        assert.equal(h.calls[0].nativeAction, false)
        assert.equal(h.calls[0].url, anchor.href)
        assert.equal(h.calls[0].attached, true)
        assert.equal(h.button(), anchor)
        isolated()
        await h.blur(); await h.tick(12000); await h.focus()
        isolated()
        assert.equal(h.calls.length, 1, 'Canceling the external prompt cannot launch another URL')
        await h.away(8000); await h.back(); await h.pagehide(); await h.pageshow()
        isolated()
        assert.equal(h.calls.length, 1, 'Browser departure/return cannot complete an affiliate step')
        await h.click(anchor)
        assert.equal(h.calls.length, 2, 'A second explicit browser-transfer tap stays available')
        isolated()
      })
    })
    await scenario(kind + ' Chrome gate scope leaves disabled flag, ordinary Chrome, iOS and inactive popups unchanged', async () => {
      for (const options of [
        { ua: android, forceChromeAndroid: false },
        { ua: androidChrome, forceChromeAndroid: true },
        { ua: facebookIos, forceChromeAndroid: true },
        { ua: safariIos, forceChromeAndroid: true },
        { ua: android, forceChromeAndroid: true, active: false, article: true },
        { ua: android, forceChromeAndroid: true, noPopup: true, article: true },
        { ua: android, forceChromeAndroid: true, tiktokEnabled: false, article: true },
        { ua: android, forceChromeAndroid: true, androidEnabled: false, article: true },
        { ua: android, forceChromeAndroid: true, androidUrl: '', tiktokUrl: '' },
      ]) await using(kind, options, async h => {
        assert.equal(h.doc.querySelector('[data-popup-browser-gate]'), null, JSON.stringify(options))
        assert.equal(h.doc.querySelector('[data-popup-chrome-link]'), null)
        if (options.article) assert.equal(h.state(), 'ARTICLE')
        else assert.equal(h.state(), 'Shopee')
        assert.equal(h.calls.length, 0)
        assert.equal(h.clickEvents.length, 0)
      })
    })
    await scenario(kind + ' Chrome continuation starts countdown and raw HTTPS affiliate sequence only after user taps', async () => {
      await using(kind, { ua: androidChrome, forceChromeAndroid: true, androidUrl: shortTikTok, cooldownMinutes: 0, firstDelay: 2, secondDelay: 3 }, async h => {
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.doc.querySelector('[data-popup-browser-gate]'), null)
        await h.click(); await h.tick(2000)
        assert.equal(h.calls.length, 0)
        assert.equal(h.clickEvents.length, 0)
        await h.click()
        assert.equal(h.calls[0].url, shopee)
        assert.equal(h.calls[0].mode, 'anchor-new-tab')
        await h.away(3500); await h.back()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.calls.length, 1)
        assert.equal(h.button().href, shortTikTok)
        await h.click()
        assert.equal(h.calls[1].url, shortTikTok)
        assert.equal(h.calls[1].mode, 'anchor-same-tab')
        await h.blur(); await h.focus()
        assert.equal(h.state(), 'TikTok')
        await h.away(); await h.back()
        assert.equal(h.state(), 'ARTICLE')
        assert.deepEqual(h.clickEvents.map(event => event.platform), ['SHOPEE', 'TIKTOK'])
      })
    })
    await scenario(kind + ' Android pending handoff never advances on blur or prompt cancellation', async () => {
      for (const ua of [android, androidChrome]) await using(kind, { ua, cooldownMinutes: 0 }, async h => {
        await h.click()
        assert.equal(h.calls[0].state, 'Shopee')
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.button().disabled, true)
        assert.equal(h.doc.querySelector('[data-popup-web-fallback]'), null, 'Do not offer a second action while launch is pending')
        await h.blur(); await h.tick(2600); await h.focus()
        assert.equal(h.state(), 'Shopee', 'Canceling the native prompt is not an app return')
        assert.equal(h.button().disabled, false)
        assert.ok(h.doc.querySelector('[data-popup-web-fallback]'))
        await h.focus(); await h.tick(5000)
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.calls.length, 1, 'Prompt events and timers must never launch again automatically')
        assert.equal(h.clickEvents.length, 1)
        await h.click()
        assert.equal(h.calls[1].url, h.calls[0].url)
        assert.equal(h.calls[1].state, 'Shopee')
        await h.away(); await h.back()
        assert.equal(h.state(), 'TikTok')
        await h.click()
        assert.equal(h.calls[2].state, 'TikTok')
        assert.equal(h.state(), 'TikTok', 'The second pending confirmation must keep the article covered')
        const marker = 'post-popup:post1:2026-09-27T00:00:00.000Z:android-return'
        const pendingMarker = h.storage.session.get(marker)
        assert.match(pendingMarker, /^2\|\d+$/)
        await h.blur(); await h.tick(2600); await h.focus()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.storage.session.get(marker), pendingMarker, 'Prompt focus must not consume the history-return marker')
        assert.equal(h.calls.length, 3)
        assert.equal(h.clickEvents.length, 3)
        await h.away(); await h.back()
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' Android pagehide and pageshow confirm handoff without blur', async () => {
      await using(kind, { ua: android }, async h => {
        await h.click()
        assert.equal(h.state(), 'Shopee')
        await h.pagehide(); await h.tick(2600); await h.pageshow()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        await h.click()
        assert.equal(h.state(), 'TikTok')
        await h.pagehide(); await h.pageshow()
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.calls.length, 2)
      })
    })
    await scenario(kind + ' Android Chrome and Facebook use visible default-action links in order', async () => {
      for (const ua of [android, androidChrome]) await using(kind, { ua, androidUrl: shortTikTok, iosUrl: 'https://example.test/ios-only', handle: 'throw' }, async h => {
        const originalAnchor = h.button()
        await h.click(); await h.click()
        assert.equal(h.calls.length, 1, 'Pending launch blocks an immediate second tap')
        const first = h.calls[0]
        assert.equal(first.mode, 'anchor-new-tab')
        assert.equal(first.target, '_blank')
        assert.equal(first.attached, true)
        assert.equal(first.hidden, false)
        assert.equal(first.nativeAction, true)
        assert.equal(h.button(), originalAnchor, 'Do not detach the tapped link before its default action')
        assert.equal(first.url, shopee)
        assert.equal(first.state, 'Shopee', 'Pending app handoff keeps the clicked popup visible')
        assert.match(first.session[0][1], /^1\|/)
        assert.equal(h.doc.querySelector('a[hidden]'), null)
        assert.equal(h.clickEvents.length, 1)
        await h.away(2000); await h.back(); await h.click()
        assert.equal(h.calls[1].mode, 'anchor-same-tab')
        assert.equal(h.calls[1].url, shortTikTok)
        assert.equal(h.calls[1].nativeAction, true)
        assert.equal(h.calls[1].hidden, false)
        assert.equal(h.calls[1].state, 'TikTok', 'The article stays covered until a confirmed departure and return')
        assert.deepEqual(h.clickEvents.map(event => event.platform), ['SHOPEE', 'TIKTOK'])
        await h.away(); await h.back(); await h.focus()
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.calls.length, 2)
        assert.equal(h.clickEvents.length, 2)
      })
    })
    await scenario(kind + ' Android short-link anchors preserve the exact source with no preparation or tap lookup', async () => {
      for (const ua of [android, androidChrome]) {
        const source = shortTikTok + "?token=a'b+A%2fB&repeat=1&repeat=2"
        await using(kind, { ua, androidUrl: source, androidLaunchUrl: helper.buildTikTokAndroidLaunchUrl(product, source) }, async h => {
          assert.equal(h.preparationRequests.length, 0)
          await withFetch(() => { throw new Error('Unexpected navigation-time lookup') }, async requests => {
            await h.click(); await h.away(); await h.back()
            const anchor = h.button()
            assert.equal(anchor.tagName, 'A')
            assert.equal(anchor.getAttribute('href'), source)
            assert.equal(anchor.href, new URL(source).href, 'Only the browser URL serializer may escape an unencoded quote')
            await h.click()
            assert.equal(h.calls[1].url, anchor.href)
            assert.equal(h.calls[1].nativeAction, true)
            assert.equal(requests.length, 0)
          })
        })
      }
    })
    await scenario(kind + ' Android countdown requires a tap and never launches from a timer', async () => {
      await using(kind, { ua: android, firstDelay: 2, secondDelay: 3 }, async h => {
        await h.click(); await h.tick(2000)
        assert.equal(h.calls.length, 0)
        assert.equal(h.clickEvents.length, 0)
        await h.click(); await h.away(3500); await h.back()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        assert.equal(h.calls.length, 1, 'Expired second countdown must not launch an app automatically')
        await h.click()
        assert.equal(h.calls.length, 2)
      })
    })
    await scenario(kind + ' Android blocked handoff restores popup and offers original web URL', async () => {
      for (const ua of [android, androidChrome]) await using(kind, { ua }, async h => {
        await h.click(); await h.tick(2499)
        assert.equal(h.calls.length, 1)
        await h.tick(1)
        assert.equal(h.state(), 'Shopee', 'No blur/visibility handoff is not a successful popup completion')
        assert.equal(h.button().disabled, false)
        assert.match([...h.storage.session.values()][0], /^1\|/, 'Keep next-step handoff for a delayed real departure')
        assert.match([...h.storage.local.values()][0], /^1\|/)
        assert.match(h.cookie(), /=1\|/)
        const fallback = h.doc.querySelector('[data-popup-web-fallback]')
        assert.ok(fallback, 'The user can explicitly open the unchanged web link')
        await h.click(fallback)
        assert.equal(h.calls.length, 2)
        assert.equal(h.calls[1].mode, 'anchor-new-tab')
        assert.equal(h.calls[1].url, shopee)
        await h.away(); await h.back()
        assert.equal(h.state(), 'TikTok')
      })
    })
    await scenario(kind + ' Android late departure clears retry UI without replaying Shopee', async () => {
      await using(kind, { ua: android }, async h => {
        await h.click(); await h.tick(2600)
        assert.equal(h.state(), 'Shopee')
        assert.ok(h.doc.querySelector('[data-popup-web-fallback]'))
        await h.away(); await h.back()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        assert.equal(h.doc.querySelector('[data-popup-web-fallback]'), null)
        assert.equal(h.calls.length, 1)
        assert.equal(h.clickEvents.length, 1)
      })
    })
    await scenario(kind + ' Android explicit app retry reuses the failed platform once', async () => {
      await using(kind, { ua: android }, async h => {
        await h.click(); await h.tick(2600)
        const originalLaunch = h.calls[0].url
        await h.click(); await h.click()
        assert.equal(h.calls.length, 2, 'Retry is explicit; repeated taps still share one pending handoff')
        assert.equal(h.calls[1].url, originalLaunch)
        assert.equal(h.calls[1].mode, 'anchor-new-tab')
        assert.deepEqual(h.clickEvents.map(event => event.platform), ['SHOPEE', 'SHOPEE'])
        await h.away(); await h.back()
        assert.equal(h.state(), 'TikTok')
      })
    })
    await scenario(kind + ' Android blocked second launch keeps TikTok visible until departure', async () => {
      await using(kind, { ua: android, androidUrl: shortTikTok }, async h => {
        await h.click(); await h.away(); await h.back(); await h.click()
        assert.equal(h.state(), 'TikTok')
        await h.tick(2600)
        assert.equal(h.state(), 'TikTok', 'An unconfirmed launch must not flash article content')
        assert.equal(h.button().disabled, false)
        assert.equal(h.calls.length, 2, 'A timeout does not itself launch a web fallback')
        const fallback = h.doc.querySelector('[data-popup-web-fallback]')
        assert.ok(fallback)
        await h.click(fallback)
        assert.equal(h.calls[2].url, shortTikTok)
        assert.equal(h.calls[2].mode, 'anchor-same-tab')
        await h.away(); await h.back(); await h.tick(2600)
        assert.equal(h.state(), 'ARTICLE')
        assert.deepEqual(h.clickEvents.map(event => event.platform), ['SHOPEE', 'TIKTOK', 'TIKTOK'])
      })
    })
    await scenario(kind + ' Android unknown Shopee links stay raw HTTPS without URL mutation', async () => {
      const source = 'https://example.test/offer?signature=A+B%2F%3D#keep'
      await using(kind, { ua: android, shopeeUrl: source }, async h => {
        await h.click()
        assert.equal(h.calls[0].mode, 'anchor-new-tab')
        assert.equal(h.calls[0].url, source)
      })
    })
    await scenario(kind + ' Android cookie-only return and zero cooldown preserve sequence', async () => {
      const state = await using(kind, { ua: android, cooldownMinutes: 0, session: false, local: false, androidUrl: shortTikTok }, async h => {
        await h.click(); await h.away(); await h.back()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        return h.snapshot()
      })
      const complete = await using(kind, { ...state, ua: android, cooldownMinutes: 0, session: false, local: false, androidUrl: shortTikTok }, async h => {
        assert.equal(h.state(), 'TikTok')
        await h.click()
        assert.equal(h.calls[0].url, shortTikTok)
        await h.away(); await h.back(); await h.tick(1000)
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.cookie(), '')
        return h.snapshot()
      })
      await using(kind, { ...complete, ua: android, cooldownMinutes: 0, session: false, local: false }, async h => assert.equal(h.state(), 'Shopee'))
    })
    await scenario(kind + ' Android explicit web fallback exceptions restore both stages without cooldown', async () => {
      await using(kind, { ua: android, anchorThrows: true }, async h => {
        await h.click(); await h.tick(2600)
        await h.click(h.doc.querySelector('[data-popup-web-fallback]'))
        assert.equal(h.calls[1].mode, 'anchor-new-tab')
        assert.equal(h.state(), 'Shopee')
        assert.equal(h.storage.session.size, 0)
        assert.equal(h.doc.querySelector('a[hidden]'), null)
        assert.ok(h.doc.querySelector('[data-popup-web-fallback]'), 'A thrown native launch also offers the web fallback')
      })
      const state = await using(kind, { ua: android }, async h => { await h.click(); return h.snapshot() })
      await using(kind, { ...state, ua: android, anchorThrows: true }, async h => {
        assert.equal(h.state(), 'TikTok')
        await h.click(); await h.tick(2600)
        await h.click(h.doc.querySelector('[data-popup-web-fallback]'))
        assert.equal(h.state(), 'TikTok')
        assert.match([...h.storage.session.values()][0], /^1\|/)
        assert.match(h.cookie(), /=1\|/)
        assert.equal(h.doc.querySelector('a[hidden]'), null)
        assert.ok(h.doc.querySelector('[data-popup-web-fallback]'))
      })
    })
    await scenario(kind + ' Android zero-cooldown history remount consumes completion once', async () => {
      const marker = 'post-popup:post1:2026-09-27T00:00:00.000Z:android-return'
      const complete = await using(kind, { ua: android, cooldownMinutes: 0 }, async h => {
        await h.click(); await h.away(); await h.back(); await h.click()
        await h.tick(2600)
        await h.click(h.doc.querySelector('[data-popup-web-fallback]'))
        assert.match(h.storage.session.get(marker), /^2\|\d+$/)
        return h.snapshot()
      })
      const consumed = await using(kind, { ...complete, ua: android, cooldownMinutes: 0, navType: 'back_forward' }, async h => {
        assert.equal(h.state(), 'ARTICLE', 'A rebuilt document after web fallback must not replay Shopee')
        assert.equal(h.storage.session.has(marker), false)
        assert.equal(h.clickEvents.length, 0)
        return h.snapshot()
      })
      await using(kind, { ...consumed, ua: android, cooldownMinutes: 0, navType: 'back_forward' }, async h => {
        assert.equal(h.state(), 'Shopee', 'History completion is consumed once, not a permanent cooldown')
      })
      for (const navType of ['navigate', 'reload']) await using(kind, { ...complete, ua: android, cooldownMinutes: 0, navType }, async h => {
        assert.equal(h.state(), 'Shopee', 'Fresh visits and reloads still honor zero cooldown')
        assert.equal(h.storage.session.has(marker), false)
      })
      const expiry = Number(complete.session.find(([key]) => key === marker)[1].split('|')[1])
      await using(kind, { ...complete, now: expiry, ua: android, cooldownMinutes: 0, navType: 'back_forward' }, async h => {
        assert.equal(h.state(), 'Shopee', 'Expired history return cannot suppress a new popup')
        assert.equal(h.storage.session.has(marker), false)
      })
    })
    await scenario(kind + ' Android genuine app returns survive denied storage and timeout', async () => {
      await using(kind, { ua: android, session: false, local: false, cookies: false }, async h => {
        await h.click(); await h.away(); await h.tick(1000); await h.back()
        assert.equal(h.state(), 'TikTok')
        assert.equal(h.button().disabled, false)
        await h.click(); await h.away(); await h.back(); await h.tick(1000)
        assert.equal(h.state(), 'ARTICLE')
        assert.equal(h.calls.length, 2)
      })
    })
  }
}

async function main() {
  if (androidNativeBaseline) {
    const helper = load('lib/popup-link.ts')
    assert.match(helper.buildAndroidPopupLaunchUrl(shortTikTok, 'TIKTOK'), /#Intent;scheme=https;package=com\.ss\.android\.ugc\.trill;/)
    for (const kind of ['route', 'react']) await using(kind, { ua: android, androidUrl: shortTikTok }, async h => {
      assert.equal(h.button().tagName, 'BUTTON')
      await h.click()
      assert.equal(h.calls[0].mode, 'anchor-same-tab')
      assert.match(h.calls[0].url, /#Intent;scheme=https;package=com\.shopee\.vn;/)
      assert.equal(h.calls[0].hidden, true)
      await h.away(); await h.back(); await h.click()
      assert.equal(h.calls[1].mode, 'anchor-same-tab')
      assert.match(h.calls[1].url, /#Intent;scheme=https;package=com\.ss\.android\.ugc\.trill;/)
      assert.equal(h.calls[1].hidden, true)
      console.log(`BASELINE ${kind} Shopee=intent-https/_self TikTok=intent-https hidden-anchor=true`)
    })
    console.log('RESULT=ANDROID_NATIVE_BASELINE_CONFIRMED native-device status=UNVERIFIED')
    return
  }
  if (androidPromptBaseline) {
    const launchUrl = load('lib/popup-link.ts').buildAndroidPopupLaunchUrl(shortTikTok, 'TIKTOK')
    assert.doesNotMatch(launchUrl, /;package=/)
    console.log('BASELINE TikTok intent package=absent')
    for (const kind of ['route', 'react']) await using(kind, { ua: android }, async h => {
      await h.click()
      assert.equal(h.calls[0].state, 'TikTok')
      await h.tick(2600)
      assert.equal(h.state(), 'Shopee')
      await h.blur(); await h.focus()
      assert.equal(h.state(), 'TikTok', 'Old blur-only prompt flow advances without actual departure')
      await h.click()
      assert.equal(h.calls[1].state, 'ARTICLE')
      await h.tick(2600)
      assert.equal(h.state(), 'TikTok')
      console.log(`BASELINE ${kind} Shopee=TikTok->Shopee prompt-focus=TikTok TikTok=ARTICLE->TikTok`)
    })
    console.log('RESULT=ANDROID_PROMPT_BASELINE_CONFIRMED')
    return
  }
  if (androidBaseline) {
    for (const kind of ['route', 'react']) {
      for (const ua of [android, androidChrome]) await using(kind, { ua, androidUrl: shortTikTok }, async h => {
        await h.click(); await h.click()
        assert.deepEqual(h.calls.map(call => [call.mode, call.url]), [['new-tab', shopee], ['new-tab', shortTikTok]])
        console.log(`BASELINE ${kind} ${ua === android ? 'Facebook' : 'Chrome'} Android Shopee=new-tab TikTok=new-tab`)
      })
    }
    console.log('RESULT=ANDROID_BASELINE_CONFIRMED')
    return
  }
  if (androidCheck || androidNativeCheck) {
    await androidScenarios()
    console.log(`RESULT=${androidNativeCheck ? 'ANDROID_NATIVE_CHECK_PASS' : 'ANDROID_CHECK_PASS'} scenarios=${passed} native-device status=UNVERIFIED`)
    return
  }
  if (preopenedBaseline) {
    for (const kind of ['route', 'react']) await using(kind, { ua: desktop, outerWidth: 1600, innerWidth: 1000 }, async h => {
      await h.tick(1500)
      assert.equal(h.calls.length, 0)
      console.log(`${kind} preopened=none`)
    })
    console.log('RESULT=PREOPENED_BASELINE_CONFIRMED')
    return
  }
  if (process.argv.includes('--export-fixture')) {
    const output = path.resolve(process.argv[process.argv.indexOf('--export-fixture') + 1])
    fs.mkdirSync(output, { recursive: true })
    const popup = { id: 'popup1', isActive: true, updatedAt: new Date('2026-09-27'), firstUrl: shopee, secondUrl: product, settings: defaultPopupSettings(shopee, product) }
    fs.writeFileSync(path.join(output, 'route-desktop.html'), await buildPage(postFixture, 'fixture.example', desktop))
    fs.writeFileSync(path.join(output, 'route-mobile.html'), await buildPage({ ...postFixture, popup }, 'fixture.example', facebookIos))
    fs.writeFileSync(path.join(output, 'route-android.html'), await buildPage({ ...postFixture, popup }, 'fixture.example', androidChrome))
    fs.writeFileSync(path.join(output, 'react-ssr.html'), '<!doctype html><html><head><meta charset="utf-8"></head><body>' + renderToStaticMarkup(await load('app/posts/[slug]/page.tsx').default({ params: Promise.resolve({ slug: 'post' }) })) + '</body></html>')
    console.log('RESULT=FIXTURES_EXPORTED')
    return
  }
  if (preopenedBaseline || preopenedCheck) {
    for (const kind of ['route', 'react']) {
      for (const [label, options] of [
        ['docked', { ua: desktop, outerWidth: 1600, innerWidth: 1000 }],
        ['emulated', { ua: facebookIos, platform: 'Win32', maxTouchPoints: 1 }],
      ]) await using(kind, options, async h => {
        await h.tick(1500)
        assert.equal(h.calls.length, preopenedBaseline ? 0 : 1)
        assert.equal(h.doc.documentElement.hasAttribute('data-post-guard-blocked'), !preopenedBaseline)
        if (preopenedCheck) assert.equal(h.calls[0].url, 'https://mesale.vn')
        console.log(`${kind} ${label} redirect=${h.calls[0]?.url || 'none'} popup=${h.button() ? 'present' : 'absent'}`)
      })
    }
    console.log(preopenedBaseline ? 'RESULT=PREOPENED_BASELINE_CONFIRMED' : 'RESULT=PREOPENED_CHECK_PASS')
    return
  }
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
  await androidScenarios()
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
  await scenario('Server short-link preparation leaves Safari, desktop and custom iOS URLs alone', async () => {
    await withFetch(() => { throw new Error('Unexpected request') }, async requests => {
      const settings = defaultPopupSettings(shopee, shortTikTok)
      for (const ua of [safariIos, desktop]) assert.equal(await prepareSettings(settings, ua), settings)
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
  await scenario('standalone guard runs in head before article and popup scripts', async () => {
    const html = await buildPage(postFixture, 'fixture.example', desktop)
    assert.ok(html.indexOf('<script>') < html.indexOf('</head>'))
    assert.match(html.slice(0, html.indexOf('</head>')), /data-post-guard-blocked/)
  })
  await scenario('both public renderers carry a no-JavaScript redirect without unconditional refresh', async () => {
    const alias = renderToStaticMarkup(await load('app/posts/[slug]/page.tsx').default({ params: Promise.resolve({ slug: 'post' }) }))
    for (const html of [await buildPage(postFixture, 'fixture.example', desktop), alias]) {
      const noScript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)
      assert.ok(noScript, 'No-JS handling is present in server HTML, not only in a hydrated component')
      assert.match(noScript[1], /http-equiv="refresh" content="0;url=https:\/\/mesale\.vn"/)
      assert.match(noScript[1], /\.managed-public-post,\.managed-popup\{display:none!important\}/)
      assert.match(noScript[1], /href="https:\/\/mesale\.vn"/)
      assert.match(html, /class="managed-public-post/)
      assert.doesNotMatch(html.replace(noScript[0], ''), /http-equiv="refresh"/)
    }
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
    await scenario(kind + ' iOS null handle without lifecycle events', async () => {
      for (const ua of [facebookIos, safariIos]) await using(kind, { ua, handle: 'null', session: false, local: false, cookies: false }, async h => {
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
        assert.equal(h.state(), ua === android ? 'Shopee' : 'TikTok')
        assert.equal(h.calls.filter(call => call.mode === 'devtools-redirect').length, 0)
      })
    })
    await scenario(kind + ' proportional desktop zoom does not redirect', async () => {
      await using(kind, { ua: desktop, outerWidth: 1600, innerWidth: 1000, outerHeight: 1200, innerHeight: 750 }, async h => {
        await h.resize(); await h.tick(1500)
        assert.equal(h.calls.length, 0)
        assert.equal(h.state(), 'ARTICLE')
      })
    })
    await scenario(kind + ' preopened side and bottom dock redirect without a key event', async () => {
      for (const dimensions of [{ outerWidth: 1600, innerWidth: 1000 }, { outerHeight: 1000, innerHeight: 600 }]) {
        for (const options of [{}, { noPopup: true }, { active: false }]) await using(kind, { ua: desktop, ...dimensions, ...options }, async h => {
          await h.tick(119)
          assert.equal(h.calls.length, 0)
          assert.equal(await h.mouse('click', false), true, 'Panel-pending clicks must not propagate')
          await h.tick(1)
          assert.equal(h.calls.length, 1)
          assert.equal(h.calls[0].url, 'https://mesale.vn')
          assert.equal(h.doc.documentElement.getAttribute('data-post-guard-blocked'), '1')
          await h.resize(); await h.back(); await h.tick(3000)
          assert.equal(h.calls.length, 1, 'Repeated events must not queue another navigation')
          assert.deepEqual(h.clickEvents, [])
        })
      }
    })
    await scenario(kind + ' emulated phone on a desktop blocks popup initialization', async () => {
      for (const platform of ['Win32', 'MacIntel', 'Linux x86_64']) {
        for (const ua of [facebookIos, android]) await using(kind, { ua, platform, maxTouchPoints: 1 }, async h => {
          await h.tick()
          assert.equal(h.calls.length, 1)
          assert.equal(h.calls[0].url, 'https://mesale.vn')
          assert.equal(h.button(), null)
          assert.equal(await h.mouse('click'), true)
          assert.deepEqual(h.storageReads, [])
          assert.deepEqual(h.clickEvents, [])
        })
      }
    })
    await scenario(kind + ' real iPad desktop mode and mobile browsers stay usable', async () => {
      for (const ua of [safariIos, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18 Safari/605']) {
        await using(kind, { ua, platform: 'MacIntel', maxTouchPoints: 5, outerWidth: 1600, innerWidth: 900 }, async h => {
          await h.tick(2000)
          assert.equal(h.calls.length, 0)
          assert.equal(await h.mouse('contextmenu'), false)
        })
      }
    })
    await scenario(kind + ' transient resize and invalid window geometry do not redirect', async () => {
      await using(kind, { ua: desktop }, async h => {
        await h.resize({ outerWidth: 1600, innerWidth: 900 }); await h.tick(60)
        await h.resize({ outerWidth: 900, innerWidth: 890 }); await h.tick(1500)
        assert.equal(h.calls.length, 0)
        await h.resize({ outerWidth: 0, innerWidth: 0 }); await h.tick(1500)
        assert.equal(h.calls.length, 0)
      })
    })
    await scenario(kind + ' visibility return rechecks a preopened panel', async () => {
      await using(kind, { ua: desktop, visibility: 'hidden', outerWidth: 1600, innerWidth: 1000 }, async h => {
        await h.tick(1500)
        assert.equal(h.calls.length, 0)
        await h.back(); await h.tick(120)
        assert.equal(h.calls.length, 1)
        assert.equal(h.calls[0].url, 'https://mesale.vn')
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
    await scenario(kind + ' Safari navigation unchanged', async () => {
      await using(kind, { ua: safariIos }, async h => {
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
      assert.equal(h.timerCount(), 0)
    })
  })
  await scenario('React guard cancels preopened panel confirmation on unmount', async () => {
    await using('react', { ua: desktop, outerWidth: 1600, innerWidth: 1000 }, async h => {
      await h.unmount(); await h.tick(1500)
      assert.equal(h.calls.length, 0)
      assert.equal(h.timerCount(), 0)
      assert.equal(h.doc.documentElement.hasAttribute('data-post-guard-blocked'), false)
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
