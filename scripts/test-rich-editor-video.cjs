/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/editor', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
global.MutationObserver = dom.window.MutationObserver
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
  const source = fs.readFileSync(file, 'utf8').replaceAll('<style jsx>', '<style>')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = id => id.startsWith('@/') ? load(path.resolve(id.slice(2))) : id.startsWith('.') ? load(path.resolve(path.dirname(file), id)) : require(id)
  new Function('require', 'module', 'exports', code)(resolve, fixture, fixture.exports)
  return fixture.exports
}
const RichEditor = load(path.resolve('app/dashboard/posts/RichEditor.tsx')).default
const helpers = load(path.resolve('app/dashboard/posts/rich-editor-video.ts'))
const media = load(path.resolve('lib/video-embed.ts'))
const root = createRoot(document.querySelector('#root'))
let saved = ''
let disabled = false
let changes = []
function Harness() {
  const [value, setValue] = React.useState(saved)
  return React.createElement(RichEditor, { value, disabled, onChange: html => { changes.push(html); saved = html; setValue(html) } })
}
async function mount(html, locked = false) {
  saved = html; disabled = locked; changes = []
  await React.act(async () => { root.render(React.createElement(Harness, { key: Math.random() })) })
}
const editor = () => document.querySelector('[aria-label="Nội dung bài viết"]')
const browserHtml = html => { const node = document.createElement('div'); node.innerHTML = html; return node.innerHTML }
const control = label => document.querySelector('button[aria-label="' + label + '"]')
const toolbar = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text)
async function click(node) { assert.ok(node, 'Click target exists'); await React.act(async () => node.click()) }
async function type(node, value) {
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
document.execCommand = (name, unused, html) => {
  if (name !== 'insertHTML') return false
  const selection = window.getSelection()
  const range = selection.rangeCount ? selection.getRangeAt(0) : document.createRange()
  if (!selection.rangeCount) { range.selectNodeContents(editor()); range.collapse(false) }
  const fragment = range.createContextualFragment(html)
  const last = fragment.lastChild
  range.deleteContents(); range.insertNode(fragment)
  if (last) { range.setStartAfter(last); range.collapse(true); selection.removeAllRanges(); selection.addRange(range) }
  return true
}

let scenarios = 0
async function scenario(name, fn) { await fn(); scenarios++; console.log('PASS ' + name) }
const iframe = '<figure class="video-embed"><iframe src="https://player.vimeo.com/video/12345?h=privacy" title="Vimeo video"></iframe></figure>'
const uploaded = '<figure class="video-embed"><video controls><source src="/uploads/content/fixture.mp4" type="video/mp4"></video></figure>'
;(async () => {
  await scenario('repeated identical embeds are independently removed without deleting surrounding content', async () => {
    await mount('<p>Keep before</p>' + iframe + iframe + uploaded + '<p>Keep after</p>')
    assert.equal(document.querySelectorAll('[aria-label^="Xóa video "]').length, 3)
    await click(control('Xóa video 2'))
    assert.equal(editor().querySelectorAll('iframe').length, 1)
    assert.equal(editor().querySelectorAll('video').length, 1)
    assert.match(saved, /Keep before/); assert.match(saved, /Keep after/)
    assert.equal(document.querySelectorAll('[aria-label^="Xóa video "]').length, 2)
  })
  await scenario('selected uploaded video can be removed by Delete and selection never serializes', async () => {
    await mount(iframe + uploaded)
    await click(control('Chọn video 2'))
    assert.equal(editor().querySelectorAll('[data-rich-editor-selected-video]').length, 1)
    assert.equal(helpers.richEditorHtml(editor()), browserHtml(iframe + uploaded))
    await React.act(async () => editor().dispatchEvent(new dom.window.Event('input', { bubbles: true })))
    assert.doesNotMatch(saved, /rich-editor-selected|Xóa video|Chọn video/)
    await React.act(async () => editor().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true })))
    assert.equal(editor().querySelectorAll('video').length, 0)
    assert.equal(editor().querySelectorAll('iframe').length, 1)
  })
  await scenario('selection places insertion after its video and both new embeds remain removable', async () => {
    await mount(iframe)
    await click(control('Chọn video 1'))
    await click(toolbar('Nhúng video'))
    await type(document.querySelector('[aria-label="Nhúng video"] textarea'), 'https://cdn.example/second.mp4?token=A+B%2f')
    await click(toolbar('Chèn video'))
    assert.equal(editor().querySelectorAll('iframe,video').length, 2)
    assert.equal(editor().querySelector('video').getAttribute('src'), 'https://cdn.example/second.mp4?token=A+B%2f')
    assert.equal(document.querySelectorAll('[aria-label^="Xóa video "]').length, 2)
    assert.doesNotMatch(saved, /rich-editor-selected|Xóa video|Chọn video/)
  })
  await scenario('multiple-video and mixed-content wrappers preserve unrelated media/text', async () => {
    await mount('<figure class="video-embed"><p>Keep caption text</p><img src="/keep.png">' + iframe + '<video src="/keep.mp4"></video></figure>')
    await click(control('Xóa video 1'))
    assert.match(saved, /Keep caption text/); assert.match(saved, /keep\.png/); assert.match(saved, /keep\.mp4/)
    assert.equal(editor().querySelectorAll('iframe').length, 0)
    await click(control('Xóa video 1'))
    assert.match(saved, /Keep caption text/); assert.match(saved, /keep\.png/)
  })
  await scenario('legacy bare iframe and empty sizing wrappers can be removed', async () => {
    await mount('<p>Before</p><div style="height:200px"><iframe></iframe></div><p>After</p>')
    await click(control('Xóa video 1'))
    assert.equal(editor().querySelector('iframe'), null)
    assert.equal(editor().querySelector('[style]'), null)
    assert.match(saved, /Before/); assert.match(saved, /After/)
  })
  await scenario('single-video figure retains caption text when only its media is deleted', async () => {
    await mount('<figure><iframe src="https://player.vimeo.com/video/12345"></iframe><figcaption>Keep existing caption</figcaption></figure>')
    await click(control('Xóa video 1'))
    assert.equal(editor().querySelector('iframe'), null)
    assert.equal(editor().querySelector('figcaption').textContent, 'Keep existing caption')
    assert.match(saved, /Keep existing caption/)
  })
  await scenario('source mode roundtrip preserves original media and rebuilds deletion controls', async () => {
    await mount(iframe + uploaded)
    await click(control('Chọn video 1'))
    await click(toolbar('Mã nguồn'))
    const source = document.querySelector('[aria-label="Mã nguồn HTML"]')
    assert.equal(source.value, iframe + uploaded)
    assert.equal(control('Xóa video 1'), null)
    await type(source, uploaded)
    await click(toolbar('Mã nguồn'))
    assert.equal(editor().querySelectorAll('iframe,video').length, 1)
    await click(control('Xóa video 1'))
    assert.equal(editor().querySelector('video'), null)
    await click(toolbar('Mã nguồn'))
    await type(document.querySelector('[aria-label="Mã nguồn HTML"]'), '')
    await click(toolbar('Mã nguồn'))
    assert.equal(control('Xóa video 1'), null, 'Empty source does not retain stale media controls')
  })
  await scenario('disabled editor prevents controls and keyboard removal from changing content', async () => {
    await mount(iframe, true)
    assert.equal(document.querySelector('[aria-label="Video trong bài viết"]').disabled, true)
    await click(control('Xóa video 1')); await click(control('Chọn video 1'))
    await React.act(async () => editor().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })))
    assert.equal(editor().querySelectorAll('iframe').length, 1)
    assert.equal(changes.length, 0)
  })
  await scenario('saved/public embed output stays unchanged without editor controls', async () => {
    const original = media.videoEmbedHtml(media.normalizeVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
    await mount(original)
    await click(control('Chọn video 1'))
    assert.equal(helpers.richEditorHtml(editor()), browserHtml(original))
    assert.equal(editor().querySelector('button'), null)
    assert.equal(editor().querySelector('iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })
  await React.act(async () => root.unmount())
  console.log('RESULT=PASS rich-editor-video-scenarios=' + scenarios)
})().catch(error => { console.error(error); process.exitCode = 1 })
