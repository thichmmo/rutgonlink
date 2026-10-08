/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/dashboard/posts', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.FormData = dom.window.FormData
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const cache = new Map()
function load(file) {
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }
  cache.set(file, fixture)
  const source = fs.readFileSync(file, 'utf8').replace('<style jsx>', '<style>')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const localRequire = id => {
    if (id === 'next/image') return props => React.createElement('img', { src: props.src, alt: props.alt })
    if (id.includes('PopupClickStats')) return { usePopupCounts: () => ({ data: null }), PopupClickBadge: () => null, PopupClickSummary: () => null }
    if (id.endsWith('/PopupTiming')) return { PopupTimingPreview: () => null }
    if (id.startsWith('@/')) return load(path.resolve(id.slice(2)))
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports)
  return fixture.exports
}
const helpers = load(path.resolve('app/dashboard/posts/telegram-media.ts'))
const Editor = load(path.resolve('app/dashboard/posts/TelegramPostEditor.tsx')).default
const Manager = load(path.resolve('app/dashboard/posts/PostManager.tsx')).default
const root = createRoot(document.querySelector('#root'))
const article = 'https://nhieuchuyenduongpho.com/2026/10/07/da-nang-10'
const signed = 'https://cdn.example/video.mp4?token=A+B%2f&token=second&expires=123#clip'
const defaults = { enabled: true, url: 'https://t.me/account_fixture', buttonText: 'Account button', disclaimer: 'Account notice' }
const oldHtml = '<p data-original="yes">Keep &amp; text</p><!--keep marker-->' + helpers.quickMediaHtml('https://cdn.example/old.mp4')
const post = { id: 'existing', title: 'Saved title', slug: 'p7-90195', excerpt: 'Saved excerpt', content: oldHtml, contentFormat: 'raw-html', popupId: 'older', popup: { id: 'older', name: 'Older popup' }, domainId: 'custom', sharedDomain: null, previewImage: null, isFakeVideo: false, isPublished: false, publicUrl: 'https://custom.example/p7/90195', publicDomain: 'custom.example', telegramSettings: { ...defaults, url: 'https://t.me/post_snapshot' } }
const popups = [{ id: 'latest', name: 'Latest popup' }, { id: 'older', name: 'Older popup' }]
const domains = [{ id: null, domain: 'fixture.example', kind: 'primary' }, { id: null, domain: 'honghotngay228.site', kind: 'shared' }, { id: 'custom', domain: 'custom.example', kind: 'custom' }]
let calls = [], requests = [], busyStates = [], inserts = [], removals = [], uploaded = []
let saved = '', format = 'rich', controls = {}, sequence = 0, uploadPending
function deferred() { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
const response = (data, ok = true) => ({ ok, json: async () => data })
global.fetch = (url, init = {}) => {
  calls.push({ url, ...init })
  if (url === '/api/content/resolve-video') {
    const pending = deferred()
    requests.push({ ...pending, init, input: JSON.parse(init.body) })
    // Deliberately allow aborted responses through: the UI must also ignore stale results.
    return pending.promise
  }
  if (url.startsWith('/api/posts?')) return Promise.resolve(response({ items: [post], total: 1 }))
  if (url === '/api/posts/options') return Promise.resolve(response({ popups, domains, telegramDefaults: defaults, canUseRawHtml: true }))
  if (url === '/api/content-blocks') return Promise.resolve(response([]))
  if (url === '/api/content/upload') return uploadPending.promise
  if ((url === '/api/posts' && init.method === 'POST') || (url === '/api/posts/existing' && init.method === 'PUT')) return Promise.resolve(response({ id: 'saved' }))
  throw new Error('Unexpected fixture request: ' + url)
}
const timers = new Map()
let timerId = 0
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.scrollTo = () => {}
window.confirm = () => true
const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const section = () => document.querySelector('[aria-label="Bài viết Telegram"]')
const inputField = () => section().querySelector('textarea[placeholder^="Dán URL video"]')
const composer = () => document.querySelector('form[role="dialog"]')
const field = (name, within = composer()) => [...within.querySelectorAll('label')].find(item => item.textContent.trimStart().startsWith(name))?.querySelector('input,textarea,select')
const mutationCalls = () => calls.filter(call => call.url.startsWith('/api/posts') && ['POST', 'PUT'].includes(call.method))
async function click(element) { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function type(element, value) {
  assert.ok(element, 'Input exists')
  const proto = element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
async function flush() { await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } }) }
async function answer(pending, data = { url: signed, kind: 'video' }, ok = true) { await React.act(async () => pending.resolve(response(data, ok))) }
async function start(url = article) { await type(inputField(), url); await click(button('Chèn video', section())); return requests.at(-1) }
async function reset() {
  await React.act(async () => root.render(null))
  calls = []; requests = []; busyStates = []; inserts = []; removals = []; uploaded = []; timers.clear()
  window.confirm = () => true
}
function Harness() {
  const [content, setContent] = React.useState(saved)
  const [settings, setSettings] = React.useState(defaults)
  const [disabled, setDisabled] = React.useState(false)
  controls = { content: next => { saved = next; setContent(next) }, disabled: setDisabled, settings: setSettings }
  return React.createElement(Editor, {
    value: settings, onChange: setSettings, content, disabled, fixedMode: true,
    onInsert: (html, replace) => {
      inserts.push({ html, replace })
      const next = helpers.appendQuickMedia(content, format, html, replace)
      saved = next.content; format = next.contentFormat; setContent(saved)
    },
    onContentChange: next => { removals.push(next); saved = next; setContent(next) },
    onUpload: file => { uploaded.push(file); return uploadPending.promise },
    onUploadingChange: busy => busyStates.push(busy),
  })
}
async function mountEditor(content = oldHtml, contentFormat = 'raw-html') {
  await reset(); saved = content; format = contentFormat
  await React.act(async () => root.render(React.createElement(Harness, { key: ++sequence })))
}
async function mountManager() {
  await reset()
  await React.act(async () => root.render(React.createElement(Manager, { key: ++sequence })))
  await flush()
}
let scenarios = 0
async function scenario(name, fn) { await fn(); scenarios++; console.log('PASS ' + name) }

;(async () => {
  await scenario('direct MP4, supported provider and pasted iframe remain synchronous without resolver requests', async () => {
    await mountEditor()
    for (const input of [signed, 'https://youtu.be/dQw4w9WgXcQ', '<iframe src="https://player.vimeo.com/video/123456"></iframe>']) {
      await type(inputField(), input); await click(button('Chèn video', section()))
      assert.equal(inserts.at(-1).html, helpers.quickMediaHtml(input))
    }
    assert.equal(requests.length, 0); assert.deepEqual(busyStates, [])
    assert.equal(saved, oldHtml + inserts.map(item => item.html).join(''))
    assert.match(inputField().placeholder, /link bài viết/)
    assert.match(section().textContent, /link bài viết HTTPS/)
  })
  await scenario('invalid URL, HTML and non-public article input shapes never start article resolution', async () => {
    await mountEditor()
    for (const input of ['bad-url', '/article', 'http://example.com/article', 'blob:https://example.com/id', '<iframe src="https://example.com/article"></iframe>', '<video src="https://example.com/unknown"></video>', 'https://user:pass@example.com/article', 'https://example.com:8080/article', 'https://localhost/article', 'https://example.local/article', 'https://127.0.0.1/article', 'https://[::1]/article']) {
      await type(inputField(), input); await click(button('Chèn video', section()))
      assert.ok(section().querySelector('[role="alert"]'))
    }
    assert.equal(requests.length, 0); assert.equal(inserts.length, 0); assert.equal(saved, oldHtml)
  })
  await scenario('article busy state blocks duplicate insert/upload/delete, allows input editing and preserves exact signed source', async () => {
    await mountEditor()
    const pending = await start('  ' + article + '?a=1&a=2+%2f  ')
    assert.deepEqual(pending.input, { url: article + '?a=1&a=2+%2f' })
    assert.equal(pending.init.method, 'POST')
    assert.equal(pending.init.headers['Content-Type'], 'application/json')
    assert.match(section().querySelector('[role="status"]').textContent, /Đang tìm video/)
    assert.equal(inputField().disabled, false)
    for (const target of [button('Chèn video', section()), button('Upload video / ảnh', section()), section().querySelector('input[type="file"]'), section().querySelector('input[type="checkbox"]')]) assert.equal(target.disabled, true)
    assert.equal(section().querySelector('[aria-label="Video và ảnh đã chèn"]').disabled, true)
    await click(button('Chèn video', section())); await click(section().querySelector('[aria-label="Xóa video 1"]'))
    assert.equal(requests.length, 1); assert.equal(removals.length, 0)
    await answer(pending, { url: signed, kind: 'video', title: 'Ignore remote title', html: '<script>ignore()</script>', extra: 'ignore' })
    assert.equal(inserts.length, 1); assert.equal(inserts[0].html, helpers.quickMediaHtml(signed)); assert.equal(inserts[0].replace, false)
    assert.equal(saved, oldHtml + helpers.quickMediaHtml(signed)); assert.equal(format, 'raw-html')
    assert.equal([...section().querySelectorAll('video')].at(-1).getAttribute('src'), signed)
    assert.doesNotMatch(saved, /Ignore remote title|ignore\(\)|extra/)
    assert.equal(inputField().value, ''); assert.deepEqual(busyStates, [true, false]); assert.equal(mutationCalls().length, 0)
  })
  await scenario('resolver video response accepts public IPv4/IPv6 and each compatible file extension', async () => {
    for (const url of ['https://8.8.8.8/video.mp4?q=+%2f&q=2', 'https://[2606:4700:4700::1111]/video.webm', 'https://cdn.example/video.ogv', 'https://cdn.example/video.ogg']) {
      await mountEditor(); const pending = await start(); await answer(pending, { url, kind: 'video' })
      assert.equal(inserts.length, 1); assert.equal(inserts[0].html, helpers.quickMediaHtml(url))
    }
  })
  await scenario('malformed success cannot insert arbitrary HTML, iframe, opaque source or noncanonical URL', async () => {
    for (const data of [null, {}, { url: 42, kind: 'video' }, { url: signed, kind: 'iframe' }, { url: signed }, { url: '<video src="https://cdn.example/v.mp4"></video>', kind: 'video' }, { url: 'https://youtu.be/dQw4w9WgXcQ', kind: 'video' }, { url: 'https://cdn.example/opaque?token=1', kind: 'video' }, { url: 'https://cdn.example/live.m3u8', kind: 'video' }, { url: 'http://cdn.example/video.mp4', kind: 'video' }, { url: 'https://user:pass@cdn.example/video.mp4', kind: 'video' }, { url: 'https://cdn.example:8443/video.mp4', kind: 'video' }, { url: 'https://CDN.example/video.mp4', kind: 'video' }]) {
      await mountEditor(); const pending = await start(); await answer(pending, data)
      assert.equal(inserts.length, 0); assert.equal(saved, oldHtml); assert.equal(inputField().value, article)
      assert.ok(section().querySelector('[role="alert"]')); assert.deepEqual(busyStates, [true, false])
    }
  })
  await scenario('server failure messages retain URL and unsaved content, clear busy and allow retry', async () => {
    for (const status of [400, 401, 422, 502, 504]) {
      await mountEditor(); const pending = await start(); await answer(pending, { error: 'Fixture error ' + status }, false)
      assert.equal(section().querySelector('[role="alert"]').textContent, 'Fixture error ' + status)
      assert.equal(inputField().value, article); assert.equal(saved, oldHtml); assert.equal(inserts.length, 0)
      assert.deepEqual(busyStates, [true, false]); assert.equal(button('Chèn video', section()).disabled, false)
      await click(button('Chèn video', section())); await answer(requests.at(-1))
      assert.equal(inserts.length, 1); assert.deepEqual(busyStates, [true, false, true, false])
    }
  })
  await scenario('network and JSON failures retain draft and release the parent busy state', async () => {
    await mountEditor(); let pending = await start()
    await React.act(async () => pending.reject(new Error('Fixture network failed')))
    assert.match(section().querySelector('[role="alert"]').textContent, /Fixture network failed/)
    assert.equal(saved, oldHtml); assert.equal(inputField().value, article); assert.deepEqual(busyStates, [true, false])
    pending = await start()
    await React.act(async () => pending.resolve({ ok: true, json: async () => { throw new Error('Fixture invalid JSON') } }))
    assert.match(section().querySelector('[role="alert"]').textContent, /Fixture invalid JSON/)
    assert.equal(inserts.length, 0); assert.deepEqual(busyStates, [true, false, true, false])
  })
  await scenario('editing URL aborts old request and late completion cannot overwrite the newer input', async () => {
    await mountEditor(); const pending = await start()
    await type(inputField(), 'https://other.example/new-article')
    assert.equal(pending.init.signal.aborted, true); assert.deepEqual(busyStates, [true, false])
    await answer(pending)
    assert.equal(inserts.length, 0); assert.equal(inputField().value, 'https://other.example/new-article')
    assert.equal(section().querySelector('[role="status"]'), null); assert.equal(section().querySelector('[role="alert"]'), null)
  })
  await scenario('overlapping requests ignore old success and error without releasing newer busy state', async () => {
    await mountEditor(); const old = await start()
    await type(inputField(), 'https://other.example/new-article'); const current = await start('https://other.example/new-article')
    await answer(old, { error: 'Stale error' }, false)
    assert.equal(inserts.length, 0); assert.equal(section().querySelector('[role="alert"]'), null)
    assert.equal(button('Chèn video', section()).disabled, true); assert.deepEqual(busyStates, [true, false, true])
    await answer(current, { url: 'https://cdn.example/new.mp4', kind: 'video' })
    assert.equal(inserts.length, 1); assert.equal(inserts[0].html, helpers.quickMediaHtml('https://cdn.example/new.mp4'))
    assert.deepEqual(busyStates, [true, false, true, false])
  })
  await scenario('late JSON body from prior request is ignored after the newer request succeeds', async () => {
    await mountEditor(); const first = await start(); const body = deferred()
    await React.act(async () => first.resolve({ ok: true, json: () => body.promise }))
    await type(inputField(), 'https://new.example/article'); const second = await start('https://new.example/article')
    await answer(second)
    await React.act(async () => body.resolve({ url: 'https://cdn.example/stale.mp4', kind: 'video' }))
    assert.equal(inserts.length, 1); assert.equal(inserts[0].html, helpers.quickMediaHtml(signed)); assert.equal(inputField().value, '')
    assert.deepEqual(busyStates, [true, false, true, false])
  })
  await scenario('external draft content change cancels resolution and keeps newer body intact', async () => {
    await mountEditor(); const pending = await start()
    await React.act(async () => controls.content('<p>Newer unsaved draft</p>'))
    assert.equal(pending.init.signal.aborted, true)
    await answer(pending)
    assert.equal(saved, '<p>Newer unsaved draft</p>'); assert.equal(inserts.length, 0); assert.equal(inputField().value, article)
    assert.deepEqual(busyStates, [true, false]); assert.equal(section().querySelector('[role="status"]'), null)
  })
  await scenario('Telegram settings metadata changes preserve insertion and use the latest parent callback', async () => {
    await mountEditor(); const pending = await start()
    await React.act(async () => controls.settings({ ...defaults, buttonText: 'New manual setting' }))
    assert.equal(pending.init.signal.aborted, false)
    await answer(pending)
    assert.equal(inserts.length, 1); assert.match(section().textContent, /New manual setting/); assert.deepEqual(busyStates, [true, false])
  })
  await scenario('external disable and Telegram mode change abort pending resolution without late insertion', async () => {
    for (const disable of [() => controls.disabled(true), () => controls.settings({ ...defaults, enabled: false })]) {
      await mountEditor(); const pending = await start(); await React.act(async () => disable())
      assert.equal(pending.init.signal.aborted, true); await answer(pending)
      assert.equal(inserts.length, 0); assert.equal(saved, oldHtml); assert.deepEqual(busyStates, [true, false])
      assert.equal(section().querySelector('[role="status"]'), null)
    }
  })
  await scenario('closed editor aborts request and late response cannot insert into next mount', async () => {
    await mountEditor(); const pending = await start()
    await mountEditor('<p>Next post body</p>')
    assert.equal(pending.init.signal.aborted, true)
    await answer(pending)
    assert.equal(saved, '<p>Next post body</p>'); assert.equal(inserts.length, 0); assert.equal(inputField().value, ''); assert.deepEqual(busyStates, [])
  })
  await scenario('replacement confirmation occurs only for valid resolved video and cancellation retains original body/input', async () => {
    await mountEditor(); await click(section().querySelector('input[type="checkbox"]'))
    let confirms = 0
    window.confirm = () => { confirms++; return false }
    let pending = await start()
    assert.equal(confirms, 0)
    await answer(pending, { error: 'No static video' }, false); assert.equal(confirms, 0)
    pending = await start(); await answer(pending)
    assert.equal(confirms, 1); assert.equal(inserts.length, 0); assert.equal(saved, oldHtml); assert.equal(inputField().value, article)
    assert.equal(section().querySelector('[role="status"]'), null)
    window.confirm = () => { confirms++; return true }
    pending = await start(); await answer(pending)
    assert.equal(confirms, 2); assert.equal(saved, helpers.quickMediaHtml(signed)); assert.equal(inserts[0].replace, true)
  })
  await scenario('resolver append keeps plain text representation and deletion/upload work after completion', async () => {
    await mountEditor('Legacy < text\nsecond line', 'plain')
    const pending = await start(); await answer(pending)
    assert.equal(saved, '<p>Legacy &lt; text<br>second line</p>' + helpers.quickMediaHtml(signed)); assert.equal(format, 'rich')
    await click(section().querySelector('[aria-label="Xóa video 1"]'))
    assert.equal(saved, '<p>Legacy &lt; text<br>second line</p><p><br></p>'); assert.equal(removals.length, 1)
    uploadPending = deferred()
    await React.act(async () => {
      const target = section().querySelector('input[type="file"]')
      Object.defineProperty(target, 'files', { value: [new dom.window.File(['fixture'], 'image.png', { type: 'image/png' })], configurable: true })
      target.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    await React.act(async () => uploadPending.resolve('/uploads/content/image.png'))
    assert.equal(uploaded.length, 1); assert.equal(inserts.length, 2); assert.match(saved, /image\.png/); assert.deepEqual(busyStates, [true, false, true, false])
  })
  await scenario('actual new Telegram form keeps defaults/manual metadata, blocks save while resolving and saves only on explicit action', async () => {
    await mountManager(); await click(button('Tạo bài Telegram'))
    assert.equal(field('Domain').value, 'shared:honghotngay228.site'); assert.equal(field('Xuất bản ngay').checked, true); assert.equal(field('Latest popup').checked, true)
    await type(field('Tiêu đề'), 'My manual title'); await type(field('Domain'), 'custom'); await click(field('Xuất bản ngay'))
    await click(field('Latest popup')); await click(field('Older popup'))
    await type(inputField(), 'https://cdn.example/manual.mp4'); await click(button('Chèn video', section()))
    const original = helpers.quickMediaHtml('https://cdn.example/manual.mp4')
    const pending = await start()
    assert.equal(button('Đang xử lý video/ảnh...', composer()).disabled, true)
    assert.equal(field('Bài thường').closest('fieldset').disabled, true)
    await React.act(async () => composer().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(mutationCalls().length, 0)
    await answer(pending)
    assert.equal(field('Tiêu đề').value, 'My manual title'); assert.equal(field('Domain').value, 'custom'); assert.equal(field('Xuất bản ngay').checked, false)
    assert.equal(field('Older popup').checked, true); assert.equal(field('Latest popup').checked, false); assert.equal(mutationCalls().length, 0)
    assert.equal(button('Lưu bài viết', composer()).disabled, false)
    await click(button('Lưu bài viết', composer()))
    const payload = JSON.parse(mutationCalls()[0].body)
    assert.equal(payload.title, 'My manual title'); assert.equal(payload.content, original + helpers.quickMediaHtml(signed))
    assert.equal(payload.domainId, 'custom'); assert.equal(payload.isPublished, false); assert.deepEqual(payload.popupIds, ['older'])
    assert.deepEqual(payload.telegramSettings, defaults); assert.equal(payload.publicLinkMode, 'numeric'); assert.equal(Object.hasOwn(payload, 'slug'), false)
    assert.equal(Object.hasOwn(payload, 'url'), false); assert.equal(Object.hasOwn(payload, 'kind'), false)
  })
  await scenario('actual existing Telegram edit preserves stored slug, body/settings/domain/popup after resolution', async () => {
    await mountManager()
    await click([...document.querySelectorAll('article')].find(item => item.textContent.includes('Saved title')).querySelector('button[title="Sửa"]'))
    const pending = await start(); await answer(pending)
    assert.equal(field('Tiêu đề').value, post.title); assert.equal(field('Slug').value, post.slug); assert.equal(field('Domain').value, 'custom')
    assert.equal(field('Older popup').checked, true); assert.equal(field('Xuất bản ngay').checked, false); assert.equal(mutationCalls().length, 0)
    await click(button('Cập nhật bài', composer()))
    const mutation = mutationCalls()[0], payload = JSON.parse(mutation.body)
    assert.equal(mutation.method, 'PUT'); assert.equal(payload.slug, post.slug); assert.equal(payload.content, oldHtml + helpers.quickMediaHtml(signed))
    assert.equal(payload.contentFormat, 'raw-html'); assert.deepEqual(payload.telegramSettings, post.telegramSettings); assert.equal(payload.domainId, 'custom'); assert.equal(payload.popupId, 'older')
    assert.equal(Object.hasOwn(payload, 'publicLinkMode'), false)
  })
  await scenario('closing actual parent composer releases busy and cannot copy late result into fresh Telegram draft', async () => {
    await mountManager(); await click(button('Tạo bài Telegram')); const pending = await start()
    await click(button('Hủy', composer())); assert.equal(pending.init.signal.aborted, true)
    await click(button('Tạo bài Telegram')); await answer(pending)
    assert.equal(inputField().value, ''); assert.equal(section().querySelector('video'), null); assert.equal(field('Tiêu đề').value, '')
    assert.equal(button('Lưu bài viết', composer()).disabled, false); assert.equal(mutationCalls().length, 0)
  })
  await React.act(async () => root.unmount())
  dom.window.close()
  console.log('RESULT=PASS article-video-ui-scenarios=' + scenarios)
})().catch(error => { console.error(error); process.exitCode = 1 })
