/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const sourceRoot = path.resolve(process.env.FIXED_CONTENT_TEST_ROOT || '.')
const baseline = process.argv.includes('--baseline')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/dashboard/posts', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
// Node 20 has no navigator, while later versions may expose a read-only property.
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
const telegramDefaults = { enabled: true, url: 'https://t.me/account_channel', buttonText: 'Account button', disclaimer: 'Account disclaimer' }
const oldTelegram = { enabled: false, url: 'https://t.me/old_channel', buttonText: 'Old button', disclaimer: 'Old disclaimer' }
const savedPost = { id: 'old-post', title: 'Existing post', slug: 'existing-post', excerpt: '', content: '<p>Existing content</p>', contentFormat: 'rich', isPublished: false, isFakeVideo: false, previewImage: '', popup: null, popupId: null, domainId: null, sharedDomain: null, telegramSettings: oldTelegram }
let blocks = [
  { id: 'before', title: 'Banner đầu bài', content: '<p>Before block</p>', contentFormat: 'rich', placement: 'before', sortOrder: 0, isActive: true },
  { id: 'after', title: 'Liên hệ cuối bài', content: 'After block', contentFormat: 'plain', placement: 'after', sortOrder: 0, isActive: true },
  { id: 'inactive', title: 'Nội dung đang tắt', content: 'Hidden block', contentFormat: 'plain', placement: 'before', sortOrder: 1, isActive: false },
]
const calls = []
const timers = new Map()
let timerId = 0
let blockReadFails = false
let nextBlockRead = null
let blockWritePending = null
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.scrollTo = () => {}
window.confirm = () => true
global.fetch = async (url, init = {}) => {
  calls.push({ url, ...init })
  if (url.startsWith('/api/posts?')) return response({ items: [savedPost], total: 1 })
  if (url === '/api/posts/options') return response({ popups: [], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults })
  if (url === '/api/settings/telegram') return response(telegramDefaults)
  if (url === '/api/content-blocks') {
    if (init.method === 'POST') {
      if (blockWritePending) await blockWritePending.promise
      const block = { id: `new-block-${blocks.length}`, ...JSON.parse(init.body) }; blocks.push(block); return response(block)
    }
    if (nextBlockRead) { const pending = nextBlockRead; nextBlockRead = null; return pending.promise }
    return blockReadFails ? response({ error: 'Fixture block load failed' }, false) : response(blocks)
  }
  if (url.startsWith('/api/content-blocks/') && init.method === 'PUT') {
    const block = blocks.find(item => item.id === url.split('/').at(-1))
    Object.assign(block, JSON.parse(init.body))
    return response(block)
  }
  if (url === '/api/posts' && init.method === 'POST') return response({ id: 'created' })
  if (url === '/api/posts/old-post' && init.method === 'PUT') return response({ id: 'old-post' })
  throw new Error('Unexpected fetch ' + url)
}

const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const composer = () => document.querySelector('form[role="dialog"]')
const manager = () => document.querySelector('[role="dialog"][aria-label="Nội dung cố định"]')
const summary = () => composer().querySelector('[aria-label="Nội dung cố định của bài viết"]')
const field = (text, within = composer()) => [...within.querySelectorAll('label')].find(label => label.textContent.startsWith(text))?.querySelector('input,textarea')
const mutations = () => calls.filter(call => call.url.startsWith('/api/posts') && ['POST', 'PUT'].includes(call.method))
const blockReads = () => calls.filter(call => call.url === '/api/content-blocks' && !call.method).length
const click = async element => { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function flush() { await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } }) }
async function input(element, value) {
  assert.ok(element, 'Input target exists')
  const proto = element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
async function submit(form) { await React.act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
async function key(element, value, shiftKey = false) { await React.act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }))) }
let passed = 0
function check(fn) { fn(); passed += 1 }

async function run() {
  const Manager = load(path.join(sourceRoot, 'app/dashboard/posts/PostManager.tsx')).default
  const root = createRoot(document.getElementById('root'))
  await React.act(async () => root.render(React.createElement(Manager)))
  await flush()
  await click(button(baseline ? 'Tạo bài viết' : 'Tạo bài Telegram'))
  await flush()

  if (baseline) {
    check(() => assert.ok(button('Nội dung cố định'), 'Old toolbar has a fixed-content control'))
    check(() => assert.equal(button('Thêm / chỉnh nội dung cố định', composer()), undefined, 'Old composer hides fixed-content controls behind modal'))
    await React.act(async () => root.unmount())
    dom.window.close()
    console.log(`BASELINE_OK fixed-content-composer=${passed} bug=toolbar-only`)
    return
  }

  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', composer()), 'Create dialog exposes fixed-content controls'))
  check(() => assert.match(summary().textContent, /Banner đầu bài[\s\S]*Liên hệ cuối bài/))
  check(() => assert.doesNotMatch(summary().textContent, /Nội dung đang tắt/, 'Inactive block must not appear as applied'))
  check(() => assert.match(summary().textContent, /tất cả bài viết/, 'Account-wide effect is disclosed'))
  await input(field('Tiêu đề'), 'Unsaved title')
  await input(field('Mô tả ngắn'), 'Unsaved description')
  await input(field('Link nhóm/kênh Telegram'), 'https://t.me/draft_channel')
  await input(field('Tạo nhanh bằng URL video'), 'https://cdn.example/draft.mp4')
  await click(button('Chèn video', composer()))
  const contentBefore = composer().querySelector('[aria-label="Bài viết Telegram"] video').src
  const composerBefore = composer()
  const editorBefore = composer().querySelector('[aria-label="Bài viết Telegram"]')
  const opener = button('Thêm / chỉnh nội dung cố định', composer())
  opener.focus()
  await click(opener)
  await flush()
  check(() => assert.ok(manager(), 'Manager opens from composer'))
  check(() => assert.equal(manager().closest('form'), null, 'Manager form is not nested in post form'))
  check(() => assert.equal(composer(), composerBefore, 'Post composer stays mounted'))
  check(() => assert.equal(composer().querySelector('[aria-label="Bài viết Telegram"]'), editorBefore, 'Quick-media editor is not remounted'))
  check(() => assert.equal(composer().parentElement.hasAttribute('inert'), true, 'Background draft cannot receive clicks or focus'))
  check(() => assert.equal(composer().parentElement.getAttribute('aria-hidden'), 'true'))
  check(() => assert.match(manager().className, /z-\[120\]/, 'Manager is above the composer'))
  check(() => assert.equal(mutations().length, 0, 'Opening manager never submits a post'))
  check(() => assert.equal(document.activeElement, manager().querySelector('input'), 'Manager receives keyboard focus'))
  const firstControl = manager().querySelector('[aria-label="Đóng nội dung cố định"]')
  const lastControl = button('Xong / quay lại bài viết', manager())
  firstControl.focus()
  await key(firstControl, 'Tab', true)
  check(() => assert.equal(document.activeElement, lastControl, 'Shift+Tab wraps inside manager'))
  await key(lastControl, 'Tab')
  check(() => assert.equal(document.activeElement, firstControl, 'Tab wraps inside manager'))

  await input(manager().querySelector('input[placeholder="Tên nội dung"]'), 'New reusable footer')
  await input(manager().querySelector('textarea[placeholder="Nội dung"]'), '<p>New fixed footer</p>')
  blockWritePending = deferred()
  await submit(manager().querySelector('form'))
  check(() => assert.equal(manager().querySelector('fieldset').disabled, true, 'Inputs locked during block save'))
  check(() => assert.equal(manager().querySelector('[aria-label="Đóng nội dung cố định"]').disabled, true))
  await key(manager(), 'Escape')
  check(() => assert.ok(manager(), 'Escape cannot discard an in-flight block save'))
  await React.act(async () => { blockWritePending.resolve(); blockWritePending = null })
  check(() => assert.ok(blocks.find(item => item.title === 'New reusable footer'), 'Block created using its own API'))
  check(() => assert.equal(mutations().length, 0, 'Block submit never bubbles into post submit'))
  check(() => assert.match(manager().textContent, /New reusable footer/, 'Manager reloads after successful save'))

  const afterRow = [...manager().querySelectorAll('p')].find(item => item.textContent === 'Liên hệ cuối bài').parentElement.parentElement
  await click(button('Đang bật', afterRow))
  check(() => assert.equal(blocks.find(item => item.id === 'after').isActive, false))
  const readsBeforeClose = blockReads()
  await click(manager().querySelector('[aria-label="Đóng nội dung cố định"]'))
  await flush()
  check(() => assert.equal(manager(), null, 'Close returns to composer'))
  check(() => assert.equal(composer().parentElement.hasAttribute('inert'), false))
  check(() => assert.ok(blockReads() > readsBeforeClose, 'Summary reloads the authoritative saved blocks'))
  check(() => assert.match(summary().textContent, /New reusable footer/))
  check(() => assert.doesNotMatch(summary().textContent, /Liên hệ cuối bài/, 'Newly disabled block no longer shown as applied'))
  check(() => assert.equal(field('Tiêu đề').value, 'Unsaved title'))
  check(() => assert.equal(field('Mô tả ngắn').value, 'Unsaved description'))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, 'https://t.me/draft_channel', 'Draft Telegram snapshot stays unchanged'))
  check(() => assert.equal(composer().querySelector('[aria-label="Bài viết Telegram"] video').src, contentBefore))
  check(() => assert.equal(document.activeElement, opener, 'Keyboard focus returns to opener'))

  await submit(composer())
  const created = JSON.parse(mutations().at(-1).body)
  check(() => assert.equal(created.telegramSettings.url, 'https://t.me/draft_channel'))
  check(() => assert.match(created.content, /draft\.mp4/, 'Saved draft media survives fixed-content management'))
  check(() => assert.doesNotMatch(created.content, /Before block|New fixed footer/, 'Global blocks are not duplicated into per-post content'))

  await click(document.querySelector('button[title="Sửa"]'))
  await flush()
  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', composer()), 'Edit dialog also exposes fixed content'))
  await input(field('Tiêu đề'), 'Edited unsaved title')
  await click(button('Thêm / chỉnh nội dung cố định', composer()))
  await flush()
  const beforeRow = [...manager().querySelectorAll('p')].find(item => item.textContent === 'Banner đầu bài').parentElement.parentElement
  await click(beforeRow.querySelector('button[title="Sửa"]'))
  await input(manager().querySelector('input[placeholder="Tên nội dung"]'), 'Updated reusable header')
  await input(manager().querySelector('textarea[placeholder="Nội dung"]'), '<p>Updated header</p>')
  await submit(manager().querySelector('form'))
  check(() => assert.equal(blocks.find(item => item.id === 'before').content, '<p>Updated header</p>'))
  await click(manager().querySelector('[aria-label="Đóng nội dung cố định"]'))
  await flush()
  check(() => assert.match(summary().textContent, /Updated reusable header/))
  check(() => assert.equal(field('Tiêu đề').value, 'Edited unsaved title'))
  check(() => assert.equal(field('Link nhóm/kênh Telegram'), undefined, 'Standard edit hides Telegram fields'))
  check(() => assert.equal(field('Bài thường (không Telegram)').checked, true))
  await submit(composer())
  const updated = JSON.parse(mutations().at(-1).body)
  check(() => assert.equal(mutations().at(-1).url, '/api/posts/old-post'))
  check(() => assert.deepEqual(updated.telegramSettings, oldTelegram))

  // A block-service failure must not erase an unrelated post draft or its media.
  blockReadFails = true
  await click(button(baseline ? 'Tạo bài viết' : 'Tạo bài Telegram'))
  await flush()
  check(() => assert.match(summary().textContent, /Fixture block load failed/))
  check(() => assert.equal(button('Lưu bài viết', composer()).disabled, false))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, telegramDefaults.url))
  await click(button('Hủy', composer()))

  blockReadFails = false
  const staleSummary = deferred()
  nextBlockRead = staleSummary
  await click(button(baseline ? 'Tạo bài viết' : 'Tạo bài Telegram'))
  check(() => assert.match(summary().textContent, /Đang tải nội dung cố định/))
  await click(button('Thêm / chỉnh nội dung cố định', composer()))
  await flush()
  await key(manager(), 'Escape')
  await flush()
  check(() => assert.equal(manager(), null, 'Escape returns to draft outside save'))
  check(() => assert.match(summary().textContent, /Updated reusable header/))
  await React.act(async () => staleSummary.resolve(response([{ ...blocks[0], title: 'Stale response title' }])))
  check(() => assert.doesNotMatch(summary().textContent, /Stale response title/, 'An older summary request cannot replace fresh block state'))
  await click(button('Hủy', composer()))
  blocks = blocks.map(block => ({ ...block, isActive: false }))
  await click(button(baseline ? 'Tạo bài viết' : 'Tạo bài Telegram'))
  await flush()
  check(() => assert.match(summary().textContent, /Chưa có nội dung cố định đang bật/))
  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', composer()), 'Empty state still exposes management'))

  // The first manager GET may still be in flight when its independent save finishes.
  for (const staleError of [false, true]) {
    const staleManager = deferred()
    nextBlockRead = staleManager
    await click(button('Thêm / chỉnh nội dung cố định', composer()))
    await flush()
    const title = staleError ? 'Latest after stale error' : 'Latest after stale list'
    await input(manager().querySelector('input[placeholder="Tên nội dung"]'), title)
    await input(manager().querySelector('textarea[placeholder="Nội dung"]'), 'Current saved block')
    await submit(manager().querySelector('form'))
    check(() => assert.match(manager().textContent, new RegExp(title), 'New saved block is visible before old response'))
    await React.act(async () => staleManager.resolve(staleError ? response({ error: 'Outdated manager error' }, false) : response([])))
    check(() => assert.match(manager().textContent, new RegExp(title), 'Old initial manager response must not replace the post-save list'))
    check(() => assert.doesNotMatch(manager().textContent, /Outdated manager error/, 'Errors from superseded manager requests are ignored'))
    await click(manager().querySelector('[aria-label="Đóng nội dung cố định"]'))
    await flush()
  }
  await click(button('Hủy', composer()))
  await click(button('Nội dung cố định'))
  await flush()
  check(() => assert.ok(manager(), 'Existing toolbar management entry still works'))
  check(() => assert.equal(composer(), null, 'Toolbar management never starts an unrelated post draft'))

  await React.act(async () => root.unmount())
  dom.window.close()
  console.log(`RESULT=PASS fixed-content-composer=${passed}`)
}

run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
