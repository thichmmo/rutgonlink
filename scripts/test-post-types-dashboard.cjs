/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const sourceRoot = path.resolve(process.env.POST_TYPES_TEST_ROOT || '.')
const baseline = process.argv.includes('--baseline')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/dashboard/posts', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement
global.FormData = dom.window.FormData
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
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const localRequire = id => {
    if (id === 'next/image') return props => React.createElement('img', { src: props.src, alt: props.alt })
    if (id.includes('PopupClickStats')) return { usePopupCounts: () => ({ data: null }), PopupClickBadge: () => null, PopupClickSummary: () => null }
    if (id.endsWith('/PopupTiming')) return { PopupTimingPreview: () => null }
    if (id.startsWith('@/')) return load(path.join(sourceRoot, id.slice(2)))
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports)
  return fixture.exports
}

const response = (data, ok = true) => ({ ok, json: async () => structuredClone(data) })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
let defaults = { enabled: true, url: 'https://t.me/account_channel', buttonText: 'Saved account button', disclaimer: 'Saved account disclaimer' }
const basic = { excerpt: '', content: '<p>Saved content</p>', contentFormat: 'rich', popup: null, popupId: null, domainId: null, sharedDomain: null, previewImage: '', isFakeVideo: false, isPublished: false, publicUrl: 'https://fixture.example/post', publicDomain: 'fixture.example' }
const regular = { ...basic, id: 'regular', title: 'Saved standard post', slug: 'saved-standard', telegramSettings: null }
const telegram = { ...basic, id: 'telegram', title: 'Saved Telegram post', slug: 'saved-telegram', telegramSettings: { ...defaults, url: 'https://t.me/post_snapshot', buttonText: 'Post snapshot', disclaimer: 'Post disclaimer' } }
const blocks = [{ id: 'header', title: 'Global header', content: '<p>Global header content</p>', contentFormat: 'rich', placement: 'before', sortOrder: 0, isActive: true }]
const calls = []
const timers = new Map()
let timerId = 0
let optionsPending = deferred()
let nextListPending = null
let uploadPending = null
let savePending = null
let listTotal = 27
let telegramSettingsSchema
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.scrollTo = () => {}
window.confirm = () => true
global.fetch = async (url, init = {}) => {
  calls.push({ url, ...init })
  if (url === '/api/posts/options') {
    if (optionsPending) return optionsPending.promise
    return response({ popups: [{ id: 'popup', name: 'Fixture popup' }], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults: defaults })
  }
  if (url.startsWith('/api/posts?')) {
    if (nextListPending) { const pending = nextListPending; nextListPending = null; return pending.promise }
    const type = new URL(url, 'https://fixture.example').searchParams.get('type')
    return response({ items: type === 'standard' ? [regular] : type === 'telegram' ? [telegram] : [regular, telegram], total: listTotal })
  }
  if (url === '/api/content-blocks') return response(blocks)
  if (url === '/api/settings/telegram') return response(defaults)
  if (url === '/api/content/upload') return uploadPending.promise
  if (url === '/api/posts' && init.method === 'POST' || /^\/api\/posts\/(regular|telegram)$/.test(url) && init.method === 'PUT') {
    // Match the real API: hidden invalid Telegram fields must not silently pass mocks.
    if (!telegramSettingsSchema.safeParse(JSON.parse(init.body).telegramSettings).success) return response({ error: 'Invalid Telegram settings fixture' }, false)
    if (savePending) return savePending.promise
    return response({ id: 'saved' })
  }
  throw new Error('Unexpected fetch ' + url)
}

const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const composer = () => document.querySelector('form[role="dialog"]')
const fields = (text, within = composer()) => [...within.querySelectorAll('label')].find(item => item.textContent.startsWith(text))?.querySelector('input,textarea,select')
const mode = type => fields(type === 'telegram' ? 'Bài Telegram' : 'Bài thường (không Telegram)')
const filter = text => button(text, document.querySelector('[aria-label="Lọc loại bài viết"]'))
const editor = () => composer().querySelector('[aria-label="Nội dung bài viết"]')
const summary = () => composer().querySelector('[aria-label="Nội dung cố định của bài viết"]')
const mutations = () => calls.filter(call => ['POST', 'PUT'].includes(call.method) && call.url.startsWith('/api/posts'))
const lastList = () => new URL(calls.filter(call => call.url.startsWith('/api/posts?')).at(-1).url, 'https://fixture.example').searchParams
const editPost = title => [...document.querySelectorAll('article')].find(item => item.textContent.includes(title))?.querySelector('button[title="Sửa"]')
const click = async element => { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function flush() { await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } }) }
async function input(element, value) {
  assert.ok(element, 'Input target exists')
  const proto = element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
async function fileInput(element, name) {
  assert.ok(element, 'File input exists')
  await React.act(async () => {
    Object.defineProperty(element, 'files', { value: [new dom.window.File(['fixture'], name, { type: 'image/png' })], configurable: true })
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}
async function submit() { await React.act(async () => composer().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
let passed = 0
function check(fn) { fn(); passed += 1 }

async function run() {
  telegramSettingsSchema = load(path.join(sourceRoot, 'lib/telegram-settings.ts')).telegramSettingsSchema
  const Manager = load(path.join(sourceRoot, 'app/dashboard/posts/PostManager.tsx')).default
  const root = createRoot(document.getElementById('root'))
  await React.act(async () => root.render(React.createElement(Manager)))
  if (!baseline) {
    check(() => assert.equal(button('Tạo bài thường').disabled, true))
    check(() => assert.equal(button('Tạo bài Telegram').disabled, true))
  }
  await flush()
  await React.act(async () => { optionsPending.resolve(response({ popups: [{ id: 'popup', name: 'Fixture popup' }], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults: defaults })); optionsPending = null })

  if (baseline) {
    check(() => assert.ok(button('Tạo bài viết')))
    check(() => assert.equal(button('Tạo bài thường'), undefined))
    check(() => assert.equal(button('Tạo bài Telegram'), undefined))
    await click(button('Tạo bài viết'))
    check(() => assert.equal(fields('Bật Telegram cho bài viết này').checked, true, 'Single create flow silently inherits enabled account default'))
    check(() => assert.equal(document.querySelector('[aria-label="Lọc loại bài viết"]'), null))
    await React.act(async () => root.unmount())
    dom.window.close()
    console.log(`BASELINE_OK post-types-dashboard=${passed} bug=combined-create-defaults`)
    return
  }

  await click(button('Tạo bài thường'))
  await flush()
  check(() => assert.equal(mode('standard').checked, true, 'Explicit standard wins over enabled account default'))
  check(() => assert.equal(composer().querySelector('[aria-label="Bài viết Telegram"]'), null))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram'), undefined))
  check(() => assert.match(summary().textContent, /Global header/))
  await input(fields('Tiêu đề'), 'Standard draft title')
  await input(fields('Slug'), 'chosen-standard-slug')
  await input(fields('Mô tả ngắn'), 'Draft excerpt')
  await input(composer().querySelector('input[placeholder="Dán URL ảnh preview..."]'), 'https://cdn.example/preview.png')
  await click(fields('Fixture popup'))
  await React.act(async () => { editor().innerHTML = '<p>Original draft body</p>'; editor().dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
  const richBefore = editor()
  await click(mode('telegram'))
  check(() => assert.equal(mode('telegram').checked, true))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram').value, defaults.url))
  check(() => assert.equal(fields('Chữ trên nút Telegram').value, defaults.buttonText))
  check(() => assert.equal(fields('Đoạn chữ dưới nút').value, defaults.disclaimer))
  check(() => assert.equal(fields('Bật Telegram cho bài viết này'), undefined, 'One mode control, not a contradictory enable toggle'))
  await input(fields('Link nhóm/kênh Telegram'), 'https://t.me/draft_snapshot')
  await input(fields('Tạo nhanh bằng URL video'), 'https://cdn.example/media.mp4')
  await click(button('Chèn video', composer()))
  await click(mode('standard'))
  check(() => assert.equal(composer().querySelector('[aria-label="Bài viết Telegram"]'), null))
  check(() => assert.notEqual(editor(), richBefore, 'Telegram unmounts the article editor; standard mode restores it from draft state'))
  check(() => assert.match(summary().textContent, /Global header/, 'Fixed content remains usable across mode changes'))
  check(() => assert.match(editor().innerHTML, /Original draft body[\s\S]*media.mp4/))
  check(() => assert.equal(fields('Tiêu đề').value, 'Standard draft title'))
  check(() => assert.equal(fields('Slug').value, 'chosen-standard-slug'))
  check(() => assert.equal(fields('Mô tả ngắn').value, 'Draft excerpt'))
  check(() => assert.equal(composer().querySelector('input[placeholder="Dán URL ảnh preview..."]').value, 'https://cdn.example/preview.png'))
  check(() => assert.equal(fields('Fixture popup').checked, true))
  await click(mode('telegram'))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram').value, 'https://t.me/draft_snapshot', 'Switching back uses draft snapshot, not account defaults'))
  await click(mode('standard'))
  await submit()
  let payload = JSON.parse(mutations().at(-1).body)
  check(() => assert.equal(payload.telegramSettings.enabled, false, 'Saved standard post explicitly disables Telegram'))
  check(() => assert.equal(payload.telegramSettings.url, 'https://t.me/draft_snapshot', 'Disabled mode preserves reusable settings'))
  check(() => assert.equal(payload.telegramSettings.buttonText, defaults.buttonText, 'Valid disabled button remains reusable'))
  check(() => assert.equal(payload.telegramSettings.disclaimer, defaults.disclaimer, 'Valid disabled disclaimer remains reusable'))
  check(() => assert.match(payload.content, /Original draft body[\s\S]*media.mp4/))
  check(() => assert.equal(payload.previewImage, 'https://cdn.example/preview.png'))
  check(() => assert.deepEqual(payload.popupIds, ['popup']))
  check(() => assert.doesNotMatch(payload.content, /Global header content/, 'Shared content is never copied into article body'))

  defaults = { ...defaults, enabled: false }
  await input(document.querySelector('input[placeholder="Tìm tiêu đề, slug..."]'), 'refresh-disabled-default')
  await flush()
  await click(button('Tạo bài Telegram'))
  check(() => assert.equal(mode('telegram').checked, true, 'Explicit Telegram wins over disabled account default'))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram').value, defaults.url))
  check(() => assert.equal(fields('Chữ trên nút Telegram').value, defaults.buttonText))
  check(() => assert.match(summary().textContent, /Global header/))
  await input(fields('Tạo nhanh bằng URL video'), 'https://cdn.example/telegram.mp4')
  await click(button('Chèn video', composer()))
  await submit()
  payload = JSON.parse(mutations().at(-1).body)
  check(() => assert.equal(payload.telegramSettings.enabled, true))
  check(() => assert.equal(payload.telegramSettings.url, defaults.url))

  await click(button('Tạo bài Telegram'))
  await input(fields('Tiêu đề'), 'Unfinished Telegram settings')
  await input(fields('Link nhóm/kênh Telegram'), 'https://example.com/not-telegram')
  await input(fields('Chữ trên nút Telegram'), '')
  await input(fields('Tạo nhanh bằng URL video'), 'https://cdn.example/validation.mp4')
  await click(button('Chèn video', composer()))
  const callsBeforeValidation = mutations().length
  await submit()
  check(() => assert.ok(composer(), 'Active Telegram validation error retains the draft'))
  check(() => assert.ok(composer().querySelector('[role="alert"]'), 'Active Telegram validation feedback remains visible'))
  check(() => assert.equal(mutations().length, callsBeforeValidation, 'Invalid Telegram settings are caught before network submission'))
  await click(mode('standard'))
  await click(mode('telegram'))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram').value, 'https://example.com/not-telegram', 'Switching alone preserves unfinished draft settings'))
  check(() => assert.equal(fields('Chữ trên nút Telegram').value, ''))
  await click(mode('standard'))
  await submit()
  payload = JSON.parse(mutations().at(-1).body)
  check(() => assert.equal(payload.telegramSettings.enabled, false))
  check(() => assert.equal(telegramSettingsSchema.safeParse(payload.telegramSettings).success, true, 'Hidden invalid fields cannot block standard save'))
  check(() => assert.equal(composer(), null, 'Standard save succeeds with valid disabled payload'))

  await click(editPost(regular.title))
  check(() => assert.equal(mode('standard').checked, true, 'Legacy null settings edit as standard'))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram'), undefined))
  await click(button('Hủy', composer()))
  await click(editPost(telegram.title))
  check(() => assert.equal(mode('telegram').checked, true))
  check(() => assert.equal(fields('Link nhóm/kênh Telegram').value, telegram.telegramSettings.url, 'Edit uses saved post snapshot'))
  await click(button('Hủy', composer()))

  await click(button('Tạo bài Telegram'))
  uploadPending = deferred()
  await fileInput(composer().querySelector('[aria-label="Bài viết Telegram"] input[type="file"]'), 'telegram.png')
  check(() => assert.ok(mode('standard').matches(':disabled'), 'Pending Telegram upload locks mode'))
  await click(mode('standard'))
  check(() => assert.equal(mode('telegram').checked, true, 'Disabled mode cannot unmount upload owner'))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/telegram.png' })))
  check(() => assert.equal(mode('standard').matches(':disabled'), false))
  await click(mode('standard'))
  uploadPending = deferred()
  await fileInput(composer().querySelector('[aria-label="Khung dán ảnh preview Facebook"] input[type="file"]'), 'preview.png')
  check(() => assert.ok(mode('telegram').matches(':disabled'), 'Pending Facebook preview upload locks mode'))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/preview.png' })))
  uploadPending = deferred()
  await fileInput([...composer().querySelectorAll('input[type="file"]')].find(item => item.accept === 'image/*' && !item.closest('[aria-label="Khung dán ảnh preview Facebook"]')), 'editor.png')
  check(() => assert.ok(mode('telegram').matches(':disabled'), 'Pending rich editor upload locks mode'))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/editor.png' })))
  await input(fields('Tiêu đề'), 'Busy save post')
  savePending = deferred()
  await submit()
  check(() => assert.ok(mode('telegram').matches(':disabled'), 'Save locks mode against payload/UI divergence'))
  await React.act(async () => { savePending.resolve(response({ id: 'saved' })); savePending = null })

  const mutationsBeforeFiltering = mutations().length
  await click(button('Sau'))
  await flush()
  check(() => assert.equal(lastList().get('page'), '2'))
  await click(filter('Bài thường'))
  await flush()
  check(() => assert.equal(lastList().get('type'), 'standard'))
  check(() => assert.equal(lastList().get('page'), '1', 'Type filter resets page before server pagination'))
  check(() => assert.equal(document.querySelectorAll('article').length, 1))
  check(() => assert.match(document.querySelector('article').textContent, /Saved standard post/))
  check(() => assert.equal(editPost(telegram.title), undefined, 'Filtered list does not show Telegram row'))
  check(() => assert.equal(filter('Bài thường').getAttribute('aria-pressed'), 'true'))

  // Resolve an older filter after the newer filter: neither rows nor page count may regress.
  const stale = deferred()
  nextListPending = stale
  await click(filter('Bài Telegram'))
  await flush()
  listTotal = 1
  await click(filter('Bài thường'))
  await flush()
  check(() => assert.equal(button('Sau').disabled, true, 'Server total defines filtered page count'))
  await React.act(async () => stale.resolve(response({ items: [telegram], total: 999 })))
  check(() => assert.equal(editPost(telegram.title), undefined, 'Stale success cannot override newer type rows'))
  check(() => assert.equal(button('Sau').disabled, true, 'Stale total cannot restore extra pages'))
  const staleError = deferred()
  nextListPending = staleError
  await click(filter('Bài Telegram'))
  await flush()
  await click(filter('Bài thường'))
  await flush()
  await React.act(async () => staleError.resolve(response({ error: 'Outdated filter failure' }, false)))
  check(() => assert.doesNotMatch(document.body.textContent, /Outdated filter failure/, 'Stale failure must not replace current list status'))
  await click(filter('Bài Telegram'))
  await flush()
  check(() => assert.equal(lastList().get('type'), 'telegram'))
  check(() => assert.match(document.querySelector('article').textContent, /Saved Telegram post/))

  const failedCurrent = deferred()
  nextListPending = failedCurrent
  await click(filter('Bài thường'))
  await flush()
  await React.act(async () => failedCurrent.resolve(response({ error: 'Current standard filter failure' }, false)))
  check(() => assert.match(document.body.textContent, /Current standard filter failure/))
  check(() => assert.equal(document.querySelectorAll('article').length, 0, 'Failed current filter must not expose the previous type rows'))
  check(() => assert.match(document.body.textContent, /0 bài · Trang 1\/1/, 'Failed filter does not retain previous total'))
  check(() => assert.equal(button('Sau').disabled, true))
  await click(button('Tải lại bài viết'))
  await flush()
  check(() => assert.equal(lastList().get('type'), 'standard', 'Retry keeps the failed filter'))
  check(() => assert.match(document.querySelector('article').textContent, /Saved standard post/))
  check(() => assert.doesNotMatch(document.body.textContent, /Current standard filter failure/, 'Successful retry removes an obsolete list failure'))

  const malformedCurrent = deferred()
  nextListPending = malformedCurrent
  await click(filter('Tất cả bài'))
  await flush()
  await React.act(async () => malformedCurrent.resolve(response({ items: [{ ...regular, telegramSettings: { ...defaults, enabled: 'true' } }], total: 1 })))
  check(() => assert.match(document.querySelector('article').textContent, /Bài thường/))
  check(() => assert.doesNotMatch(document.querySelector('article').textContent, /Bài Telegram/, 'Badge matches strict server classification; string true is not enabled'))
  listTotal = 2
  await click(filter('Bài thường'))
  await flush()
  await click(filter('Tất cả bài'))
  await flush()
  check(() => assert.equal(lastList().get('type'), 'all'))
  check(() => assert.equal(document.querySelectorAll('article').length, 2))
  check(() => assert.equal(mutations().length, mutationsBeforeFiltering, 'Filtering never rewrites posts'))

  await React.act(async () => root.unmount())
  dom.window.close()
  console.log(`RESULT=PASS post-types-dashboard=${passed}`)
}
run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
