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
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = id => id === 'next/image' ? props => React.createElement('img', { src: props.src, alt: props.alt }) : id.startsWith('@/') ? load(path.resolve(id.slice(2))) : id.startsWith('.') ? load(path.resolve(path.dirname(file), id)) : require(id)
  new Function('require', 'module', 'exports', code)(resolve, fixture, fixture.exports)
  return fixture.exports
}
const helpers = load(path.resolve('app/dashboard/posts/telegram-media.ts'))
const TelegramPostEditor = load(path.resolve('app/dashboard/posts/TelegramPostEditor.tsx')).default
const root = createRoot(document.querySelector('#root'))
const youtube = helpers.quickMediaHtml('https://youtu.be/dQw4w9WgXcQ')
const signedVideo = helpers.quickMediaHtml('https://cdn.example/video.mp4?token=A+B%2f&expires=123')
const image = helpers.quickMediaHtml('/uploads/content/image.png', 'image/png')
const settings = { enabled: true, url: 'https://t.me/fixture', buttonText: 'Join', disclaimer: 'Fixture disclaimer' }
let saved = '', format = '', insertions = [], removals = [], config = {}, uploadPending = null, uploadStates = []
function Harness() {
  const [content, setContent] = React.useState(saved)
  return React.createElement(TelegramPostEditor, {
    value: settings, onChange: () => {}, content, disabled: Boolean(config.disabled), fixedMode: true,
    onInsert: (html, replace, fileName) => {
      insertions.push({ html, replace, fileName })
      const appended = helpers.appendQuickMedia(content, format, html, replace)
      saved = appended.content; format = appended.contentFormat; setContent(saved)
    },
    onContentChange: config.noCallback ? undefined : html => { removals.push(html); saved = html; setContent(html) },
    onUpload: () => uploadPending.promise,
    onUploadingChange: uploading => uploadStates.push(uploading),
  })
}
async function mount(content, options = {}) {
  saved = content; format = options.format || 'rich'; config = options; insertions = []; removals = []; uploadStates = []
  window.confirm = () => true
  await React.act(async () => root.render(React.createElement(Harness, { key: Math.random() })))
}
const control = label => document.querySelector('button[aria-label="' + label + '"]')
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text)
async function click(element) { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function type(value) {
  await React.act(async () => {
    const element = document.querySelector('textarea[placeholder^="Dán URL video"]')
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
function preview() { return [...document.querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent === 'Xem trước bố cục Telegram') }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
let scenarios = 0
async function scenario(name, fn) { await fn(); scenarios++; console.log('PASS ' + name) }

;(async () => {
  await scenario('loaded mixed media render all previews and individual deletion preserves exact surrounding bytes', async () => {
    const before = '<p data-original="yes">Keep &amp; text before</p>'
    const after = '<p>Keep after</p><!--keep marker-->'
    await mount(before + youtube + image + signedVideo + after, { format: 'raw-html' })
    assert.equal(document.querySelectorAll('[aria-label^="Xóa "]').length, 3)
    assert.equal(preview().querySelectorAll('iframe,img,video').length, 3)
    await click(control('Xóa ảnh 2'))
    assert.equal(saved, before + youtube + signedVideo + after)
    assert.equal(format, 'raw-html')
    assert.equal(preview().querySelectorAll('iframe,img,video').length, 2)
    assert.equal(preview().querySelector('video').getAttribute('src'), 'https://cdn.example/video.mp4?token=A+B%2f&expires=123')
    assert.equal(insertions.length, 0, 'Removal never runs insertion/title/slug callback')
    assert.equal(removals.length, 1)
    assert.doesNotMatch(saved, /Xóa|Video và ảnh đã chèn/)
  })
  await scenario('repeat URL insertion produces two removable independent videos without replacing text', async () => {
    await mount('Legacy < text\nsecond line', { format: 'plain' })
    await type('https://youtu.be/dQw4w9WgXcQ'); await click(button('Chèn video'))
    await type('https://youtu.be/dQw4w9WgXcQ'); await click(button('Chèn video'))
    assert.equal(insertions.length, 2)
    assert.equal(preview().querySelectorAll('iframe').length, 2)
    assert.equal(saved, '<p>Legacy &lt; text<br>second line</p>' + youtube + youtube)
    await click(control('Xóa video 2'))
    assert.equal(saved, '<p>Legacy &lt; text<br>second line</p>' + youtube + '<p><br></p>', 'Only the selected media wrapper is removed; existing spacing stays unchanged')
    assert.equal(insertions.length, 2)
    assert.equal(preview().querySelectorAll('iframe').length, 1)
  })
  await scenario('uploaded source and mixed legacy wrappers preserve other media and caption text', async () => {
    const uploaded = '<video controls><source src="/uploads/content/clip.mp4" type="video/mp4"></video>'
    const wrap = '<figure data-old="yes"><figcaption>Keep caption</figcaption>' + uploaded + image + '</figure>'
    assert.equal(helpers.telegramMediaItems(wrap).length, 2)
    assert.equal(helpers.telegramMediaItems(wrap)[0].preview.url, '/uploads/content/clip.mp4')
    await mount(wrap)
    await click(control('Xóa video 1'))
    assert.equal(saved, '<figure data-old="yes"><figcaption>Keep caption</figcaption>' + image + '</figure>')
    await click(control('Xóa ảnh 1'))
    assert.equal(saved, '<figure data-old="yes"><figcaption>Keep caption</figcaption></figure>')
  })
  await scenario('legacy invalid sources remain removable without previewing arbitrary embedded HTML', async () => {
    const content = '<p>Before</p><div style="height:300px"><iframe src="javascript:alert(1)"></iframe></div><iframe data-src="https://youtu.be/dQw4w9WgXcQ"></iframe><p>After</p>'
    await mount(content)
    assert.equal(document.querySelectorAll('[aria-label^="Xóa video "]').length, 2)
    assert.equal(preview().querySelector('iframe'), null)
    await click(control('Xóa video 1'))
    assert.equal(saved, '<p>Before</p><iframe data-src="https://youtu.be/dQw4w9WgXcQ"></iframe><p>After</p>')
    await click(control('Xóa video 1'))
    assert.equal(saved, '<p>Before</p><p>After</p>')
  })
  await scenario('HTML tokenizer excludes fake media in scripts/comments and keeps unrelated elements intact', async () => {
    const external = '<script>const example = \'<video src="https://cdn.example/fake.mp4"></video>\';</script><!--<img src="https://cdn.example/fake.png">--><textarea><iframe src="https://youtu.be/dQw4w9WgXcQ"></iframe></textarea>'
    const content = external + '<div><button></button>' + signedVideo + '</div>'
    assert.equal(helpers.telegramMediaItems(content).length, 1)
    assert.equal(helpers.removeTelegramMedia(content, 0), external + '<div><button></button><p><br></p></div>')
    assert.equal(helpers.removeTelegramMedia(youtube + '<audio src="/keep.ogg"></audio>', 0), '<p><br></p><audio src="/keep.ogg"></audio>')
    assert.equal(helpers.removeTelegramMedia(youtube + '<button></button>', 0), '<p><br></p><button></button>')
    assert.equal(helpers.removeTelegramMedia(content, 99), content)
  })
  await scenario('removing last media removes empty insertion spacers and no stale controls remain', async () => {
    await mount('<p><br></p>' + youtube + '<div>&nbsp;</div>')
    await click(control('Xóa video 1'))
    assert.equal(saved, '')
    assert.equal(document.querySelector('[aria-label="Video và ảnh đã chèn"]'), null)
    assert.equal(preview().querySelector('iframe,video,img'), null)
  })
  await scenario('disabled editor or missing content callback prevents deletion', async () => {
    await mount(youtube, { disabled: true })
    assert.equal(document.querySelector('[aria-label="Video và ảnh đã chèn"]').disabled, true)
    await click(control('Xóa video 1'))
    assert.equal(saved, youtube); assert.equal(removals.length, 0)
    await mount(youtube, { noCallback: true })
    assert.equal(document.querySelector('[aria-label="Video và ảnh đã chèn"]').disabled, true)
    await click(control('Xóa video 1'))
    assert.equal(saved, youtube)
  })
  await scenario('replace confirmation and upload append remain independent from removal', async () => {
    await mount('<p>Original text</p>' + youtube)
    const replace = document.querySelector('input[type="checkbox"]')
    await click(replace)
    window.confirm = () => false
    await type('https://cdn.example/replace.mp4'); await click(button('Chèn video'))
    assert.equal(insertions.length, 0); assert.equal(saved, '<p>Original text</p>' + youtube)
    window.confirm = () => true
    await click(button('Chèn video'))
    assert.equal(saved, helpers.quickMediaHtml('https://cdn.example/replace.mp4'))
    assert.equal(insertions[0].replace, true)
    await mount('<p>Original text</p>' + youtube)
    uploadPending = deferred()
    const file = new dom.window.File(['fixture'], 'uploaded.png', { type: 'image/png' })
    await React.act(async () => {
      const element = document.querySelector('input[type="file"]')
      Object.defineProperty(element, 'files', { value: [file], configurable: true })
      element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    assert.equal(document.querySelector('[aria-label="Video và ảnh đã chèn"]').disabled, true)
    await click(control('Xóa video 1'))
    assert.equal(removals.length, 0, 'In-flight upload locks media deletion')
    await React.act(async () => uploadPending.resolve('/uploads/content/uploaded.png'))
    assert.equal(saved, '<p>Original text</p>' + youtube + helpers.quickMediaHtml('/uploads/content/uploaded.png', 'image/png'))
    assert.equal(insertions[0].fileName, 'uploaded.png')
    assert.deepEqual(uploadStates, [true, false])
    await click(control('Xóa ảnh 2'))
    assert.equal(saved, '<p>Original text</p>' + youtube)
  })
  await React.act(async () => root.unmount())
  console.log('RESULT=PASS telegram-media-removal-scenarios=' + scenarios)
})().catch(error => { console.error(error); process.exitCode = 1 })
