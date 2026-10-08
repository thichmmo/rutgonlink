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
const numeric = { ...basePost, id: 'numeric', title: 'Numeric link fixture', slug: 'p7-90195', publicUrl: 'https://honghotngay228.site/p7/90195', publicDomain: 'honghotngay228.site', isPublished: true, telegramSettings: defaults }
const blocks = [{ id: 'header', title: 'Shared fixed header', content: '<p>Shared header</p>', contentFormat: 'rich', placement: 'before', sortOrder: 0, isActive: true }]
const initialPopups = [{ id: 'popup', name: 'Fixture popup' }, { id: 'older', name: 'Older popup' }]
const initialDomains = [{ id: null, domain: 'fixture.example', kind: 'primary' }, { id: null, domain: 'honghotngay228.site', kind: 'shared' }, { id: 'custom', domain: 'custom.example', kind: 'custom' }]
let popupOptions = initialPopups
let domainOptions = initialDomains
let optionsPending
const calls = []
const copiedLinks = []
Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => copiedLinks.push(value) }, configurable: true })
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
  if (url.startsWith('/api/posts?')) return response({ items: [telegram, standard, numeric], total: 3 })
  if (url === '/api/posts/options') return optionsPending ? optionsPending.promise : response({ popups: popupOptions, domains: domainOptions, telegramDefaults: defaults })
  if (url === '/api/content-blocks') return response(blocks)
  if (url === '/api/settings/telegram') return response(defaults)
  if (url === '/api/content/upload') return uploadPending.promise
  if ((url === '/api/posts' && init.method === 'POST') || (/^\/api\/posts\/(telegram|standard)$/.test(url) && init.method === 'PUT')) return saveError ? response({ error: saveError }, false) : response({ id: 'saved' })
  throw new Error('Unexpected fetch ' + url)
}
const button = (text, within = document) => [...within.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const composer = () => document.querySelector('form[role="dialog"]')
const field = (text, within = composer()) => [...within.querySelectorAll('label')].find(item => item.textContent.trimStart().startsWith(text))?.querySelector('input,textarea,select')
const editor = () => composer().querySelector('[aria-label="Nội dung bài viết"]')
const advanced = () => [...composer().querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent.startsWith('Tùy chọn bài viết'))
const telegramSection = () => composer().querySelector('[aria-label="Bài viết Telegram"]')
const mutations = () => calls.filter(call => call.url.startsWith('/api/posts') && ['POST', 'PUT'].includes(call.method))
const lastPayload = () => JSON.parse(mutations().at(-1).body)
const editPost = title => [...document.querySelectorAll('article')].find(item => item.textContent.includes(title)).querySelector('button[title="Sửa"]')
const click = async element => { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function flush() { await React.act(async () => { for (const [id, fn] of timers) { timers.delete(id); fn() } }) }
async function refreshOptions() { await React.act(async () => window.dispatchEvent(new dom.window.Event('focus'))) }
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
  if (!baseline) {
    const row = [...document.querySelectorAll('article')].find(item => item.textContent.includes(numeric.title))
    check(() => assert.match(row.textContent, /honghotngay228\.site\/p7\/90195/, 'Display the API canonical URL'))
    check(() => assert.doesNotMatch(row.textContent, /p7-90195/, 'Internal stored slug is not the displayed public path'))
    check(() => assert.equal(row.querySelector('a[title="Mở bài"]').href, numeric.publicUrl))
    await click(row.querySelector('button[title="Sao chép link"]'))
    check(() => assert.equal(copiedLinks.at(-1), numeric.publicUrl))
    await click(editPost(numeric.title))
    check(() => assert.equal(field('Slug').value, numeric.slug, 'An existing numeric post keeps its stored edit identity'))
    check(() => assert.match(composer().querySelector('[aria-label="Khung dán ảnh preview Facebook"]').textContent, /\/p7\/90195/, 'The edit preview uses the public numeric path'))
    await click(button('Hủy', composer()))
  }
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
  check(() => assert.equal(field('Slug'), undefined, 'New Telegram link codes are allocated by the API'))
  check(() => assert.equal(field('Fixture popup').checked, true, 'Newest popup starts selected'))
  check(() => assert.equal(field('Older popup').checked, false))
  check(() => assert.equal(field('Xuất bản ngay').checked, true, 'Telegram creation publishes by default'))
  check(() => assert.equal(field('Domain').value, 'shared:honghotngay228.site', 'Prefer the available requested domain'))
  check(() => assert.equal(composer().noValidate, true, 'Manual Telegram validation handles collapsed fields'))
  check(() => assert.equal(telegramSection().querySelector('details').open, false, 'Saved Telegram settings remain compact'))
  check(() => assert.equal([...telegramSection().querySelectorAll('details')].find(item => /Xem trước/.test(item.querySelector('summary').textContent)).open, false))
  await submit()
  check(() => assert.equal(mutations().length, 0, 'Empty Telegram media must be validated before network save'))
  check(() => assert.match(composer().textContent, /Thêm video hoặc ảnh trước khi lưu bài Telegram/))
  await addVideo('https://cdn.example/quick.mp4')
  check(() => assert.equal(advanced().open, false, 'Quick media never forces metadata editing'))
  check(() => assert.equal(field('Tiêu đề').value, 'Video Telegram'))
  check(() => assert.equal(field('Slug'), undefined))
  check(() => assert.equal(composer().checkValidity(), true, 'Quick media resolves valid generated metadata'))
  await click(button('Lưu bài viết', composer()))
  check(() => assert.equal(composer(), null, 'Popup plus video saves without typing a body/title'))
  check(() => assert.equal(lastPayload().telegramSettings.enabled, true))
  check(() => assert.deepEqual(lastPayload().popupIds, ['popup']))
  check(() => assert.equal(lastPayload().publicLinkMode, 'numeric'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'slug'), false, 'Server owns the newly allocated code'))
  check(() => assert.equal(lastPayload().isPublished, true))
  check(() => assert.equal(lastPayload().sharedDomain, 'honghotngay228.site'))
  check(() => assert.match(lastPayload().content, /quick\.mp4/))
  check(() => assert.equal(lastPayload().contentFormat, 'rich'))
  check(() => assert.doesNotMatch(lastPayload().content, /Shared header/, 'Fixed content stays separate from media'))

  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/draft.mp4')
  await setOpen(advanced(), true)
  check(() => assert.ok(button('Thêm / chỉnh nội dung cố định', advanced())))
  check(() => assert.ok(advanced().querySelector('[aria-label="Khung dán ảnh preview Facebook"]')))
  await input(field('Tiêu đề'), 'My selected title')
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
  await input(field('Slug'), 'my-selected-slug')
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
  check(() => assert.equal(lastPayload().publicLinkMode, 'numeric'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'slug'), false, 'Mode-switch draft slug does not override a new numeric Telegram link'))
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
  check(() => assert.equal(lastPayload().slug, telegram.slug, 'Editing keeps the saved link'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'publicLinkMode'), false))
  check(() => assert.equal(lastPayload().isPublished, false, 'Create defaults never overwrite edit state'))
  check(() => assert.equal(lastPayload().domainId, null))
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

  // Existing links still validate their editable slug, independently of numeric creation.
  await click(editPost(telegram.title))
  await setOpen(advanced(), true)
  await input(field('Slug'), 'a'.repeat(191))
  await setOpen(advanced(), false)
  const beforeInvalid = mutations().length
  await submit()
  check(() => assert.equal(mutations().length, beforeInvalid))
  check(() => assert.equal(advanced().open, true, 'Invalid metadata reveals correction fields'))
  check(() => assert.match(composer().textContent, /slug/i))
  await input(field('Slug'), 'valid-slug')
  await submit()
  check(() => assert.equal(lastPayload().slug, 'valid-slug'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'publicLinkMode'), false))

  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/validation.mp4')
  await setOpen(advanced(), true)
  await input(field('Tiêu đề'), 'a'.repeat(201))
  await setOpen(advanced(), false)
  const beforeInvalidTitle = mutations().length
  await submit()
  check(() => assert.equal(mutations().length, beforeInvalidTitle))
  check(() => assert.equal(advanced().open, true))
  check(() => assert.match(composer().textContent, /tiêu đề/))
  await input(field('Tiêu đề'), 'Valid title')
  await setOpen(advanced(), false)
  saveError = 'Fixture numeric code retry failure'
  await submit()
  check(() => assert.equal(advanced().open, true, 'API metadata errors also reveal optional settings'))
  check(() => assert.match(composer().textContent, /Fixture numeric code retry failure/))
  check(() => assert.equal(field('Tiêu đề').value, 'Valid title', 'Failed saves retain draft metadata'))
  saveError = ''
  await input(field('Tiêu đề'), '')
  await setOpen(advanced(), false)
  await submit()
  check(() => assert.equal(composer(), null, 'Cleared optional title is regenerated on save'))
  check(() => assert.equal(lastPayload().title, 'Video Telegram'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'slug'), false))

  await click(button('Tạo bài Telegram'))
  uploadPending = deferred()
  await upload('new_photo.png', 'image/png')
  check(() => assert.ok(field('Bài thường (không Telegram)').matches(':disabled'), 'Upload cannot be unmounted by a mode switch'))
  check(() => assert.equal(button('Đang xử lý video/ảnh...', composer()).disabled, true))
  await click(field('Bài thường (không Telegram)'))
  check(() => assert.equal(editor(), null))
  await React.act(async () => uploadPending.resolve(response({ url: '/uploads/content/new-photo.png' })))
  check(() => assert.equal(field('Bài thường (không Telegram)').matches(':disabled'), false))
  await submit()
  check(() => assert.equal(lastPayload().title, 'new photo'))
  check(() => assert.match(lastPayload().content, /<img[^>]*new-photo\.png/))

  await click(button('Tạo bài thường'))
  check(() => assert.ok(editor()))
  check(() => assert.equal(field('Xuất bản ngay').checked, false, 'Standard creation retains its default draft state'))
  check(() => assert.equal(field('Domain').value, 'primary'))
  check(() => assert.equal(field('Fixture popup').checked, false))
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

  // Refreshing options reconciles only the new draft's popup; user metadata remains intact.
  await click(button('Tạo bài Telegram'))
  await addVideo('https://cdn.example/defaults.mp4')
  await input(field('Tiêu đề'), 'Keep this draft')
  await input(field('Domain'), 'custom')
  await click(field('Xuất bản ngay'))
  popupOptions = initialPopups.slice(1)
  await refreshOptions()
  check(() => assert.equal(field('Fixture popup'), undefined, 'Deleted newest popup disappears on refreshed options'))
  check(() => assert.equal(field('Older popup').checked, true, 'An automatic deleted choice falls back to the next valid popup'))
  check(() => assert.equal(field('Domain').value, 'custom', 'Refresh retains the chosen domain'))
  check(() => assert.equal(field('Xuất bản ngay').checked, false, 'Refresh retains publish opt-out'))
  check(() => assert.equal(field('Tiêu đề').value, 'Keep this draft'))
  popupOptions = [{ id: 'newest', name: 'Newer popup' }, ...initialPopups.slice(1)]
  await refreshOptions()
  check(() => assert.equal(field('Older popup').checked, true, 'A newer arrival does not replace a still-valid draft choice'))
  check(() => assert.equal(field('Newer popup').checked, false))
  await submit()
  check(() => assert.deepEqual(lastPayload().popupIds, ['older']))
  check(() => assert.equal(lastPayload().domainId, 'custom'))
  check(() => assert.equal(lastPayload().isPublished, false))
  check(() => assert.match(lastPayload().content, /defaults\.mp4/, 'Refreshing options never loses draft media'))

  await click(button('Tạo bài Telegram'))
  check(() => assert.equal(field('Newer popup').checked, true, 'The next draft selects the now-newest popup'))
  await addVideo('https://cdn.example/manual.mp4')
  await click(field('Newer popup'))
  await refreshOptions()
  check(() => assert.equal(field('Newer popup').checked, false, 'Explicit empty choice survives refresh'))
  check(() => assert.equal(field('Older popup').checked, false))
  await click(field('Older popup'))
  await refreshOptions()
  check(() => assert.equal(field('Older popup').checked, true, 'Manual alternate selection survives refresh'))
  check(() => assert.equal(field('Newer popup').checked, false))
  popupOptions = popupOptions.slice(0, 1)
  await refreshOptions()
  check(() => assert.equal(field('Older popup'), undefined))
  check(() => assert.equal(field('Newer popup').checked, false, 'Removing a manually chosen popup never selects another on the user\'s behalf'))
  await submit()
  check(() => assert.deepEqual(lastPayload().popupIds, []))

  popupOptions = initialPopups.slice(1)
  await refreshOptions()
  await click(button('Tạo bài Telegram'))
  check(() => assert.equal(field('Newer popup'), undefined, 'Closed-dashboard focus refresh removes deleted options before creation'))
  check(() => assert.equal(field('Older popup').checked, true, 'The next composer uses the newest remaining popup'))
  await click(button('Hủy', composer()))

  popupOptions = []
  domainOptions = initialDomains.filter(domain => domain.kind !== 'shared')
  await refreshOptions()
  await click(button('Tạo bài Telegram'))
  check(() => assert.equal(field('Domain').value, 'primary', 'Unavailable preferred domain falls back to primary'))
  check(() => assert.match(composer().textContent, /Chưa có popup bật/))
  check(() => assert.equal(field('Xuất bản ngay').checked, true))
  popupOptions = initialPopups.slice(1)
  await refreshOptions()
  check(() => assert.equal(field('Older popup').checked, true, 'An automatic empty selection can pick an arriving valid option'))

  // An options response started in Telegram must not rewrite a later standard session.
  optionsPending = deferred()
  await refreshOptions()
  await click(button('Hủy', composer()))
  await click(button('Tạo bài thường'))
  const standardDraft = composer()
  await React.act(async () => {
    optionsPending.resolve(response({ popups: [{ id: 'newest', name: 'Newer popup' }], domains: initialDomains, telegramDefaults: defaults }))
    optionsPending = undefined
  })
  check(() => assert.equal(composer(), standardDraft))
  check(() => assert.equal(field('Xuất bản ngay').checked, false))
  check(() => assert.equal(field('Domain').value, 'primary'))
  check(() => assert.equal(field('Newer popup').checked, false, 'A late response never applies Telegram defaults to a different form'))
  await click(button('Hủy', composer()))
  await click(editPost(telegram.title))
  check(() => assert.equal(field('Xuất bản ngay').checked, false))
  check(() => assert.equal(field('Domain').value, 'primary'))
  check(() => assert.equal(field('Slug').value, telegram.slug))
  const beforeEditFocus = calls.filter(call => call.url === '/api/posts/options').length
  await refreshOptions()
  check(() => assert.equal(calls.filter(call => call.url === '/api/posts/options').length, beforeEditFocus + 1, 'Global focus refresh keeps options current even during edits'))
  check(() => assert.equal(field('Xuất bản ngay').checked, false, 'Refreshed defaults do not rewrite edit fields'))
  await submit()
  check(() => assert.equal(lastPayload().popupId, 'popup', 'A saved edit retains its popup even when options omit it'))
  check(() => assert.equal(lastPayload().slug, telegram.slug))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'publicLinkMode'), false))

  popupOptions = initialPopups
  domainOptions = initialDomains
  await click(button('Tạo bài thường'))
  await click(button('Hủy', composer()))
  await click(editPost(standard.title))
  check(() => assert.equal(editor().innerHTML, mixed))
  check(() => assert.equal(field('Định dạng').value, 'rich'))
  await submit()
  check(() => assert.equal(lastPayload().slug, standard.slug, 'Standard edit retains its existing link contract'))
  check(() => assert.equal(Object.hasOwn(lastPayload(), 'publicLinkMode'), false))
  await React.act(async () => root.unmount())
  dom.window.close()
  console.log(`RESULT=PASS telegram-quick-form=${passed}`)
}
run().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
