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
global.FileReader = dom.window.FileReader
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
const root = createRoot(document.querySelector('#root'))
const iframe = '<figure class="video-embed"><iframe src="https://player.vimeo.com/video/12345?h=privacy"></iframe></figure>'
const image = '<p><img src="/uploads/content/existing.png" alt=""></p>'
const original = '<p>Keep before</p>' + iframe + image + '<p>Keep after</p>'
const signed = 'https://cdn.example/upload.mp4?token=A+B%2f&token=second&expires=123'
let saved = '', changes = [], uploads = [], busyStates = [], commands = [], config = {}, pending, controls, sequence = 0, forceDecline = false
const editor = () => document.querySelector('[aria-label="Nội dung bài viết"]')
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const source = () => document.querySelector('[aria-label="Mã nguồn HTML"]')
const status = () => document.querySelector('[role="status"]')?.textContent || ''
function deferred() { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
document.execCommand = (command, unused, html) => {
  if (command !== 'insertHTML') return false
  // Match the browser's refusal to edit a locked upload target. Older mocks
  // silently accepted this, masking successful uploads whose body stayed empty.
  const editable = editor()?.getAttribute('contenteditable') === 'true'
  const allowed = editable && !forceDecline
  commands.push({ command, editable, allowed })
  if (!allowed) return false
  const selection = window.getSelection()
  if (!selection?.rangeCount) return false
  const range = selection.getRangeAt(0)
  const fragment = range.createContextualFragment(html)
  const last = fragment.lastChild
  range.deleteContents(); range.insertNode(fragment)
  if (last) { range.setStartAfter(last); range.collapse(true); selection.removeAllRanges(); selection.addRange(range) }
  return true
}
function Harness() {
  const [value, setValue] = React.useState(saved)
  const [disabled, setDisabled] = React.useState(Boolean(config.disabled))
  controls = { value: next => { saved = next; setValue(next) }, disabled: setDisabled }
  return React.createElement(RichEditor, {
    value, disabled,
    onChange: html => { saved = html; changes.push(html); setValue(html) },
    onUpload: config.noUpload ? undefined : file => { uploads.push(file); return pending.promise },
    onUploadingChange: busy => busyStates.push(busy),
  })
}
async function mount(html = original, options = {}) {
  await React.act(async () => root.render(null))
  saved = html; config = options; changes = []; uploads = []; busyStates = []; commands = []; forceDecline = false; pending = deferred()
  window.prompt = () => null
  await React.act(async () => root.render(React.createElement(Harness, { key: ++sequence })))
}
async function click(node) { assert.ok(node, 'Click target exists'); await React.act(async () => node.click()) }
async function type(node, value) {
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
async function upload(kind = 'image', file = new dom.window.File(['fixture'], kind === 'image' ? 'fixture.png' : 'fixture.mp4', { type: kind === 'image' ? 'image/png' : 'video/mp4' })) {
  await React.act(async () => {
    const input = [...document.querySelectorAll('input[type="file"]')].find(node => kind === 'image' ? node.accept === 'image/*' : node.accept.startsWith('video/'))
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}
async function resolve(url) { await React.act(async () => pending.resolve(url)) }
async function caretBefore(node) {
  await React.act(async () => {
    editor().focus()
    const range = document.createRange(); range.setStartBefore(node); range.collapse(true)
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
    editor().dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }))
  })
}
async function pasteImage(files, items = []) {
  const event = new dom.window.Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files, items } })
  await React.act(async () => editor().dispatchEvent(event))
  return event
}
let scenarios = 0
async function scenario(name, fn) { await fn(); scenarios++; console.log('PASS ' + name) }

;(async () => {
  await scenario('locked image upload inserts at saved caret and preserves mixed body', async () => {
    await mount(); await caretBefore(editor().querySelector('figure'))
    await upload()
    assert.equal(editor().getAttribute('contenteditable'), 'false')
    assert.equal(document.querySelector('fieldset').disabled, true)
    await resolve('/uploads/content/new.png')
    assert.equal(uploads[0].name, 'fixture.png'); assert.equal(uploads[0].type, 'image/png')
    assert.deepEqual(commands, [{ command: 'insertHTML', editable: false, allowed: false }])
    assert.equal(saved, '<p>Keep before</p><p><img src="/uploads/content/new.png" alt=""></p>' + iframe + image + '<p>Keep after</p>')
    assert.equal(editor().querySelectorAll('img').length, 2); assert.equal(editor().querySelectorAll('iframe').length, 1)
    assert.equal(editor().getAttribute('contenteditable'), 'true'); assert.match(status(), /Đã tải ảnh lên/)
    assert.deepEqual(busyStates, [true, false]); assert.equal(changes.length, 1)
  })
  await scenario('locked MP4 upload inserts playable source attributes and preserves signed query exactly', async () => {
    await mount(); await caretBefore(editor().lastElementChild); await upload('video'); await resolve(signed)
    const video = editor().querySelector('video')
    assert.ok(video); assert.equal(video.getAttribute('preload'), 'metadata'); assert.equal(video.hasAttribute('controls'), true); assert.equal(video.hasAttribute('playsinline'), true)
    assert.equal(video.querySelector('source').getAttribute('src'), signed); assert.equal(video.querySelector('source').getAttribute('type'), 'video/mp4')
    assert.equal(editor().querySelectorAll('img').length, 1); assert.equal(editor().querySelectorAll('iframe').length, 1)
    assert.match(saved, /Keep before/); assert.match(saved, /Keep after/); assert.equal(editor().querySelectorAll('video').length, 1)
    assert.deepEqual(commands, [{ command: 'insertHTML', editable: false, allowed: false }]); assert.deepEqual(busyStates, [true, false]); assert.match(status(), /Đã tải video lên/)
  })
  await scenario('empty locked rich editor gains media rather than reporting success with an empty body', async () => {
    for (const kind of ['image', 'video']) {
      await mount(''); await upload(kind); await resolve('/uploads/content/new.' + (kind === 'image' ? 'png' : 'mp4'))
      assert.ok(saved); assert.equal(editor().querySelectorAll(kind === 'image' ? 'img' : 'video').length, 1)
      assert.equal(changes.length, 1); assert.equal(commands[0].allowed, false)
    }
  })
  await scenario('pasted clipboard files and item fallback follow the same locked upload insertion', async () => {
    for (const viaItems of [false, true]) {
      await mount(); await caretBefore(editor().querySelector('figure'))
      const file = new dom.window.File(['fixture'], 'clipboard.png', { type: 'image/png' })
      const event = await pasteImage(viaItems ? [] : [file], viaItems ? [{ kind: 'file', type: 'image/png', getAsFile: () => file }] : [])
      assert.equal(event.defaultPrevented, true); assert.equal(uploads.length, 1); assert.equal(editor().getAttribute('contenteditable'), 'false')
      await resolve('/uploads/content/pasted.png')
      assert.equal(editor().querySelector('img').getAttribute('src'), '/uploads/content/pasted.png')
      assert.match(saved, /Keep before/); assert.match(saved, /Keep after/); assert.equal(commands[0].allowed, false)
    }
  })
  await scenario('native insertion stays available for direct video and image URL controls', async () => {
    await mount(); await caretBefore(editor().querySelector('figure'))
    await click(button('Nhúng video')); await type(document.querySelector('[aria-label="Nhúng video"] textarea'), signed); await click(button('Chèn video'))
    assert.equal(commands[0].allowed, true); assert.equal(commands[0].editable, true)
    assert.equal(editor().querySelector('video').getAttribute('src'), signed)
    window.prompt = () => 'https://cdn.example/photo.png?key=A+B%2f'
    await click(button('Ảnh URL'))
    assert.equal(commands[1].allowed, true); assert.equal(editor().querySelectorAll('img').length, 2); assert.equal(uploads.length, 0)
    assert.match(saved, /Keep before/); assert.match(saved, /Keep after/)
  })
  await scenario('native refusal on an editable target safely falls back at the selected text range', async () => {
    await mount('Before selected After')
    await React.act(async () => {
      const range = document.createRange(); range.setStart(editor().firstChild, 7); range.setEnd(editor().firstChild, 15)
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
      editor().dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }))
    })
    forceDecline = true
    await click(button('Nhúng video')); await type(document.querySelector('[aria-label="Nhúng video"] textarea'), 'https://youtu.be/dQw4w9WgXcQ'); await click(button('Chèn video'))
    assert.equal(commands[0].allowed, false); assert.equal(commands[0].editable, true)
    assert.equal(editor().querySelectorAll('iframe').length, 1); assert.match(saved, /^Before /); assert.match(saved, / After$/); assert.doesNotMatch(saved, /selected/)
  })
  await scenario('successive locked uploads keep the updated insertion caret and original following text', async () => {
    await mount('<p>Before</p><p>After</p>'); await caretBefore(editor().lastElementChild)
    await upload(); await resolve('/uploads/content/one.png')
    pending = deferred(); await upload('video'); await resolve('/uploads/content/two.mp4')
    const children = [...editor().children]
    assert.equal(children[0].textContent, 'Before'); assert.equal(children[1].querySelector('img').getAttribute('src'), '/uploads/content/one.png')
    assert.equal(children[2].querySelector('source').getAttribute('src'), '/uploads/content/two.mp4'); assert.equal(children.at(-1).textContent, 'After')
    assert.deepEqual(commands.map(command => command.allowed), [false, false]); assert.equal(changes.length, 2); assert.deepEqual(busyStates, [true, false, true, false])
  })
  await scenario('source mode uploads append original HTML without calling native insertion', async () => {
    await mount(); await click(button('Mã nguồn')); assert.equal(source().value, original)
    await upload('video'); assert.equal(source().disabled, true); await resolve('/uploads/content/source.mp4')
    assert.ok(saved.startsWith(original)); assert.match(source().value, /source\.mp4/); assert.equal(commands.length, 0); assert.deepEqual(busyStates, [true, false])
    await click(button('Mã nguồn')); assert.equal(editor().querySelectorAll('video').length, 1); assert.equal(editor().querySelectorAll('iframe').length, 1)
  })
  await scenario('failed upload preserves original body and releases all editor controls for retry', async () => {
    await mount(); await upload()
    await React.act(async () => pending.reject(new Error('Fixture upload failed')))
    assert.equal(saved, original); assert.equal(changes.length, 0); assert.equal(commands.length, 0); assert.equal(editor().getAttribute('contenteditable'), 'true')
    assert.match(status(), /Fixture upload failed/); assert.deepEqual(busyStates, [true, false])
    pending = deferred(); await upload(); await resolve('/uploads/content/retry.png'); assert.equal(changes.length, 1)
  })
  await scenario('unavailable selection reports insertion failure without a false upload-success message', async () => {
    await mount(); await upload()
    const getSelection = window.getSelection
    window.getSelection = () => null
    try { await resolve('/uploads/content/no-range.png') } finally { window.getSelection = getSelection }
    assert.equal(saved, original); assert.equal(changes.length, 0); assert.equal(editor().querySelectorAll('img').length, 1)
    assert.match(status(), /Không thể chèn media/); assert.doesNotMatch(status(), /Đã tải ảnh lên/); assert.deepEqual(busyStates, [true, false])
  })
  await scenario('duplicate file/paste actions during upload do not start a second request', async () => {
    await mount(); await upload(); await upload('video')
    await pasteImage([new dom.window.File(['fixture'], 'second.png', { type: 'image/png' })])
    assert.equal(uploads.length, 1); await resolve('/uploads/content/only.png')
    assert.equal(changes.length, 1); assert.equal(editor().querySelectorAll('img').length, 2); assert.equal(editor().querySelector('video'), null)
  })
  await scenario('closed editor ignores late uploaded media and cannot alter the next draft', async () => {
    await mount(); await upload(); const old = pending
    await mount('<p>Next draft</p>')
    await React.act(async () => old.resolve('/uploads/content/stale.png'))
    assert.equal(saved, '<p>Next draft</p>'); assert.equal(editor().querySelector('img'), null); assert.equal(changes.length, 0); assert.deepEqual(busyStates, [])
  })
  await scenario('wrong MIME, disabled controls and clipboard text do not upload or insert media', async () => {
    await mount(); await upload('image', new dom.window.File(['fixture'], 'wrong.mp4', { type: 'video/mp4' }))
    assert.equal(uploads.length, 0); assert.equal(saved, original); assert.match(status(), /Vui lòng chọn tệp hình ảnh/)
    const event = await pasteImage([], [{ kind: 'string', type: 'text/plain', getAsFile: () => null }]); assert.equal(event.defaultPrevented, false)
    await React.act(async () => controls.disabled(true)); await upload()
    assert.equal(uploads.length, 0); assert.equal(changes.length, 0)
  })
  await scenario('fallback FileReader image insertion remains functional without a server upload callback', async () => {
    await mount('', { noUpload: true }); await upload()
    for (let attempt = 0; attempt < 20 && changes.length === 0; attempt++) await React.act(async () => new Promise(resolve => setTimeout(resolve, 5)))
    assert.equal(uploads.length, 0); assert.equal(changes.length, 1); assert.match(editor().querySelector('img').getAttribute('src'), /^data:image\/png;base64,/)
    assert.equal(commands[0].allowed, false); assert.deepEqual(busyStates, [true, false])
  })
  await React.act(async () => root.unmount()); dom.window.close()
  console.log('RESULT=PASS rich-editor-upload-scenarios=' + scenarios)
})().catch(error => { console.error(error); process.exitCode = 1 })
