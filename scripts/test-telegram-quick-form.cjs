/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const sourceRoot = path.resolve(process.env.TELEGRAM_QUICK_FORM_TEST_ROOT || '.')
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
const defaults = { enabled: true, url: 'https://t.me/account_channel', buttonText: 'Account button', disclaimer: 'Account notice' }
const mixed = '<p>Legacy body must survive</p><video src="https://cdn.example/old.mp4" controls=""></video><p>Legacy ending</p>'
const basePost = { excerpt: 'Saved excerpt', content: mixed, contentFormat: 'rich', popup: { id: 'popup', name: 'Fixture popup' }, popupId: 'popup', domainId: null, sharedDomain: null, previewImage: 'https://cdn.example/poster.png', isFakeVideo: false, isPublished: false, publicUrl: 'https://fixture.example/post', publicDomain: 'fixture.example' }
const telegram = { ...basePost, id: 'telegram', title: 'Saved Telegram', slug: 'saved-telegram', telegramSettings: { ...defaults, url: 'https://t.me/post_snapshot' } }
const standard = { ...basePost, id: 'standard', title: 'Saved standard', slug: 'saved-standard', telegramSettings: null }
const blocks = [{ id: 'header', title: 'Shared fixed header', content: '<p>Shared header</p>', contentFormat: 'rich', placement: 'before', sortOrder: 0, isActive: true }]
const calls = []
const timers = new Map()
let timerId = 0
let uploadPending
let saveError = ''
window.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
window.clearTimeout = id => timers.delete(id)
window.scrollTo = () => {}
window.confirm = () => true
global.fetch = async (url, init = {}) => {
  calls.push({ url, ...init })
  if (url.startsWith('/api/posts?')) return response({ items: [telegram, standard], total: 2 })
  if (url === '/api/posts/options') return response({ popups: [{ id: 'popup', name: 'Fixture popup' }], domains: [{ id: null, domain: 'fixture.example', kind: 'primary' }, { id: 'custom', domain: 'custom.example', kind: 'custom' }], telegramDefaults: defaults })
  if (url === '/api/content-blocks') return response(blocks)
  if (url === '/api/settings/telegram') return response(defaults)
  if (url === '/api/content/upload') return uploadPending.promise
  if ((url === '/api/posts' && init.method === 'POST') || (/^\/api\/posts\/(telegram|standard)$/.test(url) && init.method === 'PUT')) return saveError ? response({ error: saveError }, false) : response({ id: 'saved' })
  throw new Error('Unexpected fetch ' + url)
}
const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const composer = () => document.querySelector('form[role="dialog"]')
const field = (text, within = composer()) => [...within.querySelectorAll('label')].find(item => item.textContent.startsWith(text))?.querySelector('input,textarea,select')
const editor = () => composer().querySelector('[aria-label="Nội dung bài viết"]')
const advanced = () => [...composer().querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent.startsWith('Tùy chọn bài viết'))
const telegramSection = () => composer().querySelector('[aria-label="Bài viết Telegram"]')
const mutations = () => calls.filter(call => call.url.startsWith('/api/posts') && ['POST', 'PUT'].includes(call.method))
const lastPayload = () => JSON.parse(mutations().at(-1).body)
const editPost = title => [...document.querySelectorAll('article')].find(item => item.textContent.includes(title)).querySelector('button[title="Sửa"]')
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
async function setOpen(details, open) { await React.act(async () => { details.open = open; details.dispatchEvent(new dom.window.Event('toggle')) }) }
async function submit() { await React.act(async () => composer().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
async function addVideo(url) { await input(field('Tạo nhanh bằng URL video'), url); await click(button('Chèn video', composer())) }
async function upload(name, type) {
  await React.act(async () => {
    const element = telegramSection().querySelector('input[type="file"]')
    Object.defineProperty(element, 'files', { value: [new dom.window.File(['fixture'], name, { type })], configurable: true })
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}
let passed = 0
function check(fn) { fn(); passed += 1 }

async function run() {
  const Manager = load(path.join(sourceRoot, 'app/dashboard/posts/PostManager.tsx')).default
  const root = createRoot(document.getElementById('root'))
  await React.act(async () => root.render(React.createElement(Manager)))
  await flush()
  await click(button('Tạo bài Telegram'))
  if (baseline) {
    check(() => assert.ok(editor(), 'Old Telegram form still mounts the article editor'))
    check(() => assert.ok(field('Định dạng'), 'Old Telegram form still asks for article format'))
    check(() => assert.equal(advanced(), undefined, 'Old metadata is not collapsible'))
    check(() => assert.equal(field('Tiêu đề').required, true))
    await React.act(async () => root.unmount())
    dom.window.close()
    console.log(`BASELINE_OK telegram-quick-form=${passed} bug=article-editor-in-telegram`)
    return
  }

  check(() => assert.equal(editor(), null, 'Telegram must not mount the article editor'))
  check(() => assert.equal(field('Định dạng'), undefined, 'Telegram must not expose an article format selector'))
  check(() => assert.equal(advanced().open, false, 'Optional metadata starts collapsed'))
  check(() => assert.ok(field('Fixture popup'), 'Popup selection is directly available'))
  check(() => assert.equal(field('Fixture popup').closest('details'), null, 'Popup selection is not hidden in advanced settings'))
  check(() => assert.equal(field('Tiêu đề').required, false, 'Collapsed fields cannot block native submit'))
  check(() => assert.equal(field('Slug').required, false))
  check(() => assert.equal(composer().noValidate, true, 'Manual Telegram validation handles collapsed fields'))
  check(() => assert.equal(telegramSection().querySelector('details').open, false, 'Saved Telegram settings remain compact'))
  check(() => assert.equal([...telegramSection().querySelectorAll('details')].find(item => /Xem trước/.test(item.querySelector('summary').textContent)).open, false))
  await submit()
  check(() => assert.equal(mutations().length, 0, 'Empty Telegram media must be validated before network save'))
  check(() => assert.match(composer().textContent, /Thêm video hoặc ảnh trước khi lưu bài Telegram/))
  await addVideo('https://cdn.example/quick.mp4')
  await click(field('Fixture popup'))
  check(() => assert.equal(advanced().open, false, 'Quick media never forces metadata editing'))
  check(() => assert.equal(field('Tiêu đề').value, 'Video Telegram'))
  check(() => assert.match(field('Slug').value, /^video-telegram-[a-z0-9]+$/))
  check(() => assert.equal(composer().checkValidity(), true, 'Quick media resolves valid generated metadata'))
  await click(button('Lưu bài viết', composer()))
  check(() => assert.equal(composer(), null, 'Popup plus video saves without typing a body/title'))
  check(() => assert.equal(lastPayload().telegramSettings.enabled, true))
  check(() => assert.deepEqual(lastPayload().popupIds, ['popup']))
  check(() => assert.match(lastPayload().content, /quick\.mp4/))
  check(() => assert.equal(lastPayload().contentFormat, 'rich'))
  check(() => assert.doesNotMatch(lastPayload().content, /Shared header/, 'Fixed content stays separate from media'))

  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/draft.mp4')
  await setOpen(advanced(), true)
  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', advanced())))
  check(() => assert.ok(advanced().querySelector('[aria-label="Khung dán ảnh preview Facebook"]')))
  await input(field('Tiêu đề'), 'My selected title')
  await input(field('Slug'), 'my-selected-slug')
  await input(field('Mô tả ngắn'), 'My chosen excerpt')
  await input(field('Domain'), 'custom')
  await input(composer().querySelector('input[placeholder="Dán URL ảnh preview..."]'), 'https://cdn.example/draft-poster.png')
  const draft = composer()
  await click(button('Thêm / chỉnh nội dung cố định', composer()))
  await flush()
  const manager = document.querySelector('[role="dialog"][aria-label="Nội dung cố định"]')
  check(() => assert.ok(manager))
  check(() => assert.equal(composer(), draft, 'Fixed-content overlay does not replace the draft'))
  await click(button('Xong / quay lại bài viết', manager))
  await flush()
  check(() => assert.equal(field('Tiêu đề').value, 'My selected title'))
  check(() => assert.equal(advanced().open, true, 'Returning from fixed content preserves optional settings state'))
  await click(field('Bài thường (không Telegram)'))
  check(() => assert.ok(editor(), 'Standard mode restores the full editor'))
  check(() => assert.ok(field('Định dạng')))
  check(() => assert.equal(field('Tiêu đề').required, true, 'Standard native validation remains'))
  check(() => assert.equal(composer().noValidate, false, 'Standard form keeps native validity checks'))
  check(() => assert.match(editor().innerHTML, /draft\.mp4/))
  check(() => assert.equal(field('Mô tả ngắn').value, 'My chosen excerpt'))
  await React.act(async () => { editor().innerHTML += '<p>Standard body survives unmount</p>'; editor().dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
  await click(field('Bài Telegram'))
  check(() => assert.equal(editor(), null))
  await click(field('Bài thường (không Telegram)'))
  check(() => assert.match(editor().innerHTML, /draft\.mp4[\s\S]*Standard body survives unmount/))
  await click(field('Bài Telegram'))
  await submit()
  check(() => assert.match(lastPayload().content, /draft\.mp4[\s\S]*Standard body survives unmount/))
  check(() => assert.equal(lastPayload().title, 'My selected title'))
  check(() => assert.equal(lastPayload().slug, 'my-selected-slug'))
  check(() => assert.equal(lastPayload().previewImage, 'https://cdn.example/draft-poster.png'))
  check(() => assert.equal(lastPayload().domainId, 'custom'))

  await click(editPost(telegram.title))
  check(() => assert.equal(editor(), null, 'Existing Telegram posts also use compact UI'))
  check(() => assert.equal(field('Định dạng'), undefined))
  check(() => assert.equal(advanced().open, false))
  check(() => assert.equal(field('Link nhóm/kênh Telegram').value, telegram.telegramSettings.url))
  await submit()
  check(() => assert.equal(mutations().at(-1).url, '/api/posts/telegram'))
  check(() => assert.equal(lastPayload().content, mixed, 'Saving legacy mixed content is lossless'))
  check(() => assert.equal(lastPayload().contentFormat, 'rich'))
  check(() => assert.equal(lastPayload().title, telegram.title))
  check(() => assert.equal(lastPayload().popupId, 'popup'))
  check(() => assert.equal(lastPayload().previewImage, telegram.previewImage))
  await click(editPost(telegram.title))
  await addVideo('https://cdn.example/new.mp4')
  await submit()
  check(() => assert.match(lastPayload().content, /Legacy body must survive[\s\S]*old\.mp4[\s\S]*Legacy ending[\s\S]*new\.mp4/, 'Append media preserves all mixed content'))

  for (const contentFormat of ['plain', 'raw-html']) {
    telegram.contentFormat = contentFormat
    telegram.content = contentFormat === 'plain' ? 'Legacy plain A < B\nsecond line' : '<p data-legacy="yes">Legacy raw content</p>'
    await input(document.querySelector('input[placeholder="Tìm tiêu đề, slug..."]'), contentFormat)
    await flush()
    await click(editPost(telegram.title))
    check(() => assert.equal(editor(), null))
    check(() => assert.equal(field('Định dạng'), undefined))
    check(() => assert.match(telegramSection().textContent, /nội dung cũ/, 'Legacy text gets preservation guidance'))
    await submit()
    check(() => assert.equal(lastPayload().contentFormat, contentFormat))
    check(() => assert.equal(lastPayload().content, telegram.content, 'Compact edit does not convert or drop legacy content'))
  }
  telegram.contentFormat = 'rich'
  telegram.content = mixed

  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/settings.mp4')
  const settings = telegramSection().querySelector('details')
  await setOpen(settings, true)
  await input(field('Link nhóm/kênh Telegram'), 'not-a-url')
  await setOpen(settings, false)
  const beforeSettingsValidation = mutations().length
  check(() => assert.equal(composer().checkValidity(), false, 'Fixture exercises a native invalid URL in a closed details'))
  await click(button('Lưu bài viết', composer()))
  check(() => assert.equal(mutations().length, beforeSettingsValidation, 'Manual validation handles native invalid hidden URL'))
  check(() => assert.equal(settings.open, true, 'Bad Telegram link reveals settings instead of blocking silently'))
  check(() => assert.match(composer().textContent, /Link Telegram phải là HTTPS/))
  await input(field('Link nhóm/kênh Telegram'), defaults.url)
  await click(button('Lưu bài viết', composer()))
  check(() => assert.equal(composer(), null, 'Corrected Telegram link saves via normal submit button'))

  // Collapsed metadata must expose errors rather than leaving an unfocusable invalid field.
  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/validation.mp4')
  await setOpen(advanced(), true)
  await input(field('Slug'), 'a'.repeat(191))
  await setOpen(advanced(), false)
  const beforeInvalid = mutations().length
  await submit()
  check(() => assert.equal(mutations().length, beforeInvalid))
  check(() => assert.equal(advanced().open, true, 'Invalid metadata reveals correction fields'))
  check(() => assert.match(composer().textContent, /slug/i))
  await input(field('Slug'), 'valid-slug')
  await setOpen(advanced(), false)
  saveError = 'Fixture slug collision'
  await submit()
  check(() => assert.equal(advanced().open, true, 'API metadata errors also reveal optional settings'))
  check(() => assert.match(composer().textContent, /Fixture slug collision/))
  check(() => assert.equal(field('Slug').value, 'valid-slug', 'Failed saves retain draft metadata'))
  saveError = ''
  await input(field('Tiêu đề'), '')
  await input(field('Slug'), '')
  await setOpen(advanced(), false)
  await submit()
  check(() => assert.equal(composer(), null, 'Cleared optional title/slug are regenerated on save'))
  check(() => assert.equal(lastPayload().title, 'Video Telegram'))
  check(() => assert.match(lastPayload().slug, /^video-telegram-[a-z0-9]+$/))

  await click(button('Tạo bài Telegram'))
  uploadPending = deferred()
  await upload('new_photo.png', 'image/png')
  check(() => assert.ok(field('Bài thường (không Telegram)').matches(':disabled'), 'Upload cannot be unmounted by a mode switch'))
  check(() => assert.equal(button('Đang tải tệp...', composer()).disabled, true))
  await click(field('Bài thường (không Telegram)'))
  check(() => assert.equal(editor(), null))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/new-photo.png' })))
  check(() => assert.equal(field('Bài thường (không Telegram)').matches(':disabled'), false))
  await submit()
  check(() => assert.equal(lastPayload().title, 'new photo'))
  check(() => assert.match(lastPayload().content, /<img[^>]*new-photo\.png/))

  await click(button('Tạo bài thường'))
  check(() => assert.ok(editor()))
  check(() => assert.ok(field('Định dạng')))
  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', composer())))
  check(() => assert.ok(composer().querySelector('[aria-label="Khung dán ảnh preview Facebook"]')))
  check(() => assert.equal(telegramSection(), null))
  check(() => assert.equal(advanced(), undefined, 'Standard fields remain expanded'))
  check(() => assert.equal(composer().checkValidity(), false, 'Empty standard metadata retains native required validation'))
  await input(field('Định dạng'), 'plain')
  check(() => assert.ok(composer().querySelector('textarea[placeholder="Viết nội dung dạng văn bản..."]').required))
  await click(field('Bài Telegram'))
  check(() => assert.equal(composer().querySelector('textarea[placeholder="Viết nội dung dạng văn bản..."]'), null, 'A required plain article field cannot block Telegram'))
  await addVideo('https://cdn.example/from-plain.mp4')
  await click(button('Lưu bài viết', composer()))
  check(() => assert.equal(composer(), null, 'Plain-to-Telegram switch saves with only inserted media'))
  check(() => assert.equal(lastPayload().contentFormat, 'rich'))
  check(() => assert.match(lastPayload().content, /from-plain\.mp4/))
  await click(button('Tạo bài thường'))
  await click(button('Hủy', composer()))
  await click(editPost(standard.title))
  check(() => assert.equal(editor().innerHTML, mixed))
  check(() => assert.equal(field('Định dạng').value, 'rich'))
  await React.act(async () => root.unmount())
  dom.window.close()
  console.log(`RESULT=PASS telegram-quick-form=${passed}`)
}
run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
