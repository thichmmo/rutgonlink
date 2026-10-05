/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/dashboard/posts', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
// Node 20 has no global navigator; newer Node versions expose a read-only one.
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement
global.FormData = dom.window.FormData
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const cache = new Map()

function load(file) {
  file = file.replaceAll('\\', '/')
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }
  cache.set(file, fixture)
  // Next compiles styled-jsx; remove only its JSX marker in this plain React harness.
  const source = fs.readFileSync(file, 'utf8').replace('<style jsx>', '<style>')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const localRequire = id => {
    if (id === 'next/image') return props => React.createElement('img', { src: props.src, alt: props.alt })
    if (id.includes('PopupClickStats')) return { usePopupCounts: () => ({ data: null }), PopupClickBadge: () => null, PopupClickSummary: () => null }
    if (id.endsWith('/PopupTiming')) return { PopupTimingPreview: () => null }
    if (id === './FixedContentManager') return () => null
    if (id.startsWith('@/')) return load(id.slice(2))
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports)
  return fixture.exports
}

function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const response = (data, ok = true) => ({ ok, json: async () => data })
const initial = { enabled: true, url: 'https://t.me/account_original', buttonText: 'Account original', disclaimer: 'Original disclaimer' }
const savedPost = { id: 'old-post', title: 'Existing post', slug: 'existing-post', content: '<p>Existing content</p>', contentFormat: 'rich', isPublished: false, isFakeVideo: false, popup: null, popupId: null, domainId: null, sharedDomain: null, telegramSettings: { enabled: false, url: 'https://t.me/old_post', buttonText: 'Saved old post', disclaimer: 'Old disclaimer' } }
let defaults = { ...initial }
let optionsPending = deferred()
let uploadPending = null
const calls = []
const timers = new Map()
let timerId = 0
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.scrollTo = () => {}
window.confirm = () => true
global.fetch = async (url, init = {}) => {
  calls.push({ url, ...init })
  if (url === '/api/posts/options') {
    if (optionsPending) return optionsPending.promise
    return response({ popups: [], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults: defaults })
  }
  if (url.startsWith('/api/posts?')) return response({ items: [savedPost], total: 1 })
  if (url === '/api/settings/telegram') {
    if (init.method === 'PUT') defaults = JSON.parse(init.body)
    return response(defaults)
  }
  if (url === '/api/content/upload') return uploadPending.promise
  if (url === '/api/posts' && init.method === 'POST') return response({ id: 'created' })
  if (url === '/api/posts/old-post' && init.method === 'PUT') return response({ id: 'old-post' })
  throw new Error('Unexpected fetch ' + url)
}

const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const dialog = () => document.querySelector('form[role="dialog"]')
const field = (text, within = dialog()) => [...within.querySelectorAll('label')].find(label => label.textContent.startsWith(text))?.querySelector('input,textarea')
const click = async element => { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function input(element, value) {
  assert.ok(element, 'Input target exists')
  const proto = element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
async function fileInput(element, file) {
  await React.act(async () => {
    Object.defineProperty(element, 'files', { value: [file], configurable: true })
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}
const postCalls = () => calls.filter(call => call.url === '/api/posts' && call.method === 'POST')
let passed = 0
function check(fn) { fn(); passed += 1 }

async function run() {
  const { quickMediaHtml, appendQuickMedia, quickMediaTitle, quickMediaSlug, telegramMediaPreview } = load('app/dashboard/posts/telegram-media.ts')
  check(() => assert.equal(quickMediaHtml('javascript:alert(1)'), null))
  check(() => assert.equal(quickMediaHtml('data:text/html,<script>'), null))
  check(() => assert.match(quickMediaHtml('/uploads/content/test.png', 'image/png'), /<img src="\/uploads\/content\/test.png"/))
  check(() => assert.match(appendQuickMedia('A < B\nnext', 'plain', '<video></video>', false).content, /A &lt; B<br>next/))
  check(() => assert.equal(appendQuickMedia('keep', 'rich', 'new', false).content, 'keepnew'))
  check(() => assert.equal(appendQuickMedia('keep', 'rich', 'new', true).content, 'new'))
  check(() => assert.equal(quickMediaTitle('my_video.mp4'), 'my video'))
  check(() => assert.equal(quickMediaSlug('a'.repeat(200)).length, 190))
  check(() => assert.match(quickMediaSlug('你好🙂'.repeat(50)), /^bai-telegram-[a-z0-9]+$/))
  check(() => assert.match(quickMediaSlug('a-'.repeat(100)), /^[a-z0-9]+(-[a-z0-9]+)*$/))
  check(() => assert.equal(telegramMediaPreview('<iframe src="javascript:alert(1)"></iframe>'), null))

  const Manager = load('app/dashboard/posts/PostManager.tsx').default
  const root = createRoot(document.getElementById('root'))
  await React.act(async () => root.render(React.createElement(Manager)))
  check(() => assert.equal(button('Tạo bài viết').disabled, true, 'Wait for actual account defaults'))
  await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } })
  check(() => assert.equal(button('Tạo bài viết').disabled, true, 'Pending options must not create an empty snapshot'))
  await React.act(async () => {
    optionsPending.resolve(response({ popups: [], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults: defaults }))
    optionsPending = null
  })
  await click(button('Tạo bài viết'))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, initial.url))
  await input(field('Tạo nhanh bằng URL video'), 'https://youtu.be/dQw4w9WgXcQ')
  await click(button('Chèn video'))
  check(() => assert.equal(field('Tiêu đề').value, 'Video Telegram'))
  check(() => assert.match(field('Slug').value, /^video-telegram-[a-z0-9]+$/))
  check(() => assert.match(document.querySelector('[aria-label="Nội dung bài viết"]').innerHTML, /youtube-nocookie/))

  await input(field('Tiêu đề'), 'Title chosen by user')
  await input(field('Tạo nhanh bằng URL video'), 'https://cdn.example/video.mp4')
  await click(button('Chèn video'))
  check(() => assert.equal(field('Tiêu đề').value, 'Title chosen by user'))
  check(() => assert.match(document.querySelector('[aria-label="Nội dung bài viết"]').innerHTML, /youtube-nocookie[\s\S]*cdn.example/))

  await React.act(async () => dialog().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
  check(() => assert.deepEqual(JSON.parse(postCalls().at(-1).body).telegramSettings, initial))
  await click(button('Tạo bài viết'))
  optionsPending = deferred()
  await input(document.querySelector('input[placeholder="Tìm tiêu đề, slug..."]'), 'pending-filter')
  await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } })
  await click(button('Mặc định Telegram'))
  const accountDialog = document.querySelector('[aria-label="Cài đặt Telegram mặc định"]')
  await input(field('Link nhóm/kênh Telegram', accountDialog), 'https://t.me/account_changed')
  await click(button('Lưu mặc định Telegram', accountDialog))
  check(() => assert.equal(postCalls().length, 1, 'Saving defaults never submits the post form'))
  await React.act(async () => {
    optionsPending.resolve(response({ popups: [], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }], telegramDefaults: initial }))
    optionsPending = null
  })
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, initial.url, 'Open draft remains its own snapshot'))
  await click(accountDialog.querySelector('[aria-label="Đóng cài đặt Telegram"]'))
  await click(button('Hủy'))

  await click(button('Tạo bài viết'))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, 'https://t.me/account_changed', 'An older options response cannot overwrite explicitly saved defaults'))
  await click(button('Hủy'))
  await click(document.querySelector('button[title="Sửa"]'))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, 'https://t.me/old_post'))
  check(() => assert.equal(field('Bật Telegram cho bài viết này').checked, false, 'Existing post does not adopt defaults'))
  await click(button('Hủy'))

  await click(button('Tạo bài viết'))
  uploadPending = deferred()
  const telegramSection = document.querySelector('[aria-label="Bài viết Telegram"]')
  await fileInput(telegramSection.querySelector('input[type="file"]'), new dom.window.File(['image'], 'sample.png', { type: 'image/png' }))
  check(() => assert.equal(button('Đang tải tệp...').disabled, true, 'Cannot save before the upload completes'))
  await click(button('Hủy'))
  await click(button('Tạo bài viết'))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/stale.png' })))
  check(() => assert.equal(field('Tiêu đề').value, '', 'Closed-form upload never supplies the new form title'))
  check(() => assert.doesNotMatch(document.querySelector('[aria-label="Nội dung bài viết"]').innerHTML, /stale.png/))
  check(() => assert.equal(button('Lưu bài viết').disabled, false))

  uploadPending = deferred()
  await fileInput(document.querySelector('[aria-label="Bài viết Telegram"] input[type="file"]'), new dom.window.File(['image'], 'my_photo.png', { type: 'image/png' }))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/current.png' })))
  check(() => assert.equal(field('Tiêu đề').value, 'my photo'))
  check(() => assert.match(document.querySelector('[aria-label="Nội dung bài viết"]').innerHTML, /current.png/))
  await click(button('Hủy'))

  // Rich-editor uploads have the same lifetime rules as the fast template uploads.
  await click(button('Tạo bài viết'))
  await click(button('Nhúng video'))
  uploadPending = deferred()
  await fileInput([...dialog().querySelectorAll('input[type="file"]')].find(item => item.accept === 'image/*' && !item.closest('[aria-label="Khung dán ảnh preview Facebook"]')), new dom.window.File(['image'], 'rich.png', { type: 'image/png' }))
  check(() => assert.equal(button('Đang tải tệp...').disabled, true))
  check(() => assert.equal([...dialog().querySelectorAll('label')].find(item => item.textContent.startsWith('Định dạng')).querySelector('select').disabled, true, 'Changing format cannot unmount a pending rich upload'))
  check(() => assert.equal(dialog().querySelector('fieldset[aria-label="Nhúng video"]').disabled, true, 'The embed drawer is locked during upload'))
  await click(button('Hủy'))
  await click(button('Tạo bài viết'))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/stale-rich.png' })))
  check(() => assert.doesNotMatch(document.querySelector('[aria-label="Nội dung bài viết"]').innerHTML, /stale-rich/))
  await React.act(async () => root.unmount())
  dom.window.close()
  console.log(`RESULT=PASS telegram-dashboard=${passed}`)
}

run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
