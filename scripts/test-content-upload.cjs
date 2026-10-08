/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Readable } = require('node:stream')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const { getCloneableBody } = require('next/dist/server/body-streams')
const { defaultConfig } = require('next/dist/server/config-shared')
const bytes = require('next/dist/compiled/bytes')

const root = path.resolve(__dirname, '..')
// Canonicalize macOS's /var symlink before comparing persistent upload paths.
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rutgonlink-upload-api-')))
const directory = path.join(temp, 'media')
const previousDirectory = process.env.CONTENT_UPLOAD_DIR
process.env.CONTENT_UPLOAD_DIR = directory
const cache = new Map()
const auth = { allowed: true, calls: 0 }
let scenarios = 0

function load(relative) {
  const file = path.join(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }
  cache.set(file, fixture)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  function resolve(id) {
    if (id === '@/lib/content-management') return {
      getManagedContentUserId: async () => { auth.calls++; return auth.allowed ? 'fixture-user' : null },
    }
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(resolve, fixture, fixture.exports)
  return fixture.exports
}

const helper = load('lib/content-upload.ts')
const uploadRoute = load('app/api/content/upload/route.ts')
const mediaRoute = load('app/uploads/content/[...path]/route.ts')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')
const savedCount = () => fs.existsSync(directory) ? fs.readdirSync(directory).length : 0

async function scenario(name, callback) {
  try { await callback(); scenarios++ } catch (error) { error.message = name + ': ' + error.message; throw error }
}

function multipart(file) {
  const form = new FormData()
  if (file !== undefined) form.append('file', file)
  return new NextRequest('http://127.0.0.1/api/content/upload', { method: 'POST', body: form })
}

async function post(request) {
  const response = await uploadRoute.POST(request)
  return { status: response.status, body: await response.json() }
}

async function assertSaved(result, expected, mime) {
  assert.equal(result.status, 201)
  const saved = result.body
  assert.match(saved.filename, /^[a-f0-9-]+\.(?:png|jpg|webp|gif|avif|mp4|webm|ogv)$/)
  assert.equal(saved.url, '/uploads/content/' + saved.filename)
  assert.equal(saved.mimeType, mime)
  assert.equal(saved.kind, mime.startsWith('image/') ? 'image' : 'video')
  assert.equal(saved.size, expected.length)
  const file = helper.resolveContentUploadPath(saved.filename)
  assert.equal(file, path.join(directory, saved.filename))
  assert.deepEqual(fs.readFileSync(file), expected)
  const response = await mediaRoute.GET(new Request('http://127.0.0.1' + saved.url), {
    params: Promise.resolve({ path: [saved.filename] }),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Type'), mime)
  assert.equal(response.headers.get('Content-Length'), String(expected.length))
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected)
}

async function assertRejected(file, error) {
  const before = savedCount()
  const response = await post(multipart(file))
  assert.equal(response.status, 400)
  assert.match(response.body.error, error)
  assert.equal(savedCount(), before)
}

async function cloneMultipart(file, limit) {
  const request = multipart(file)
  const body = Buffer.from(await request.arrayBuffer())
  const chunks = []
  for (let offset = 0; offset < body.length; offset += 64 * 1024) chunks.push(body.subarray(offset, offset + 64 * 1024))
  const stream = Readable.from(chunks)
  stream.url = '/api/content/upload'
  const cloner = getCloneableBody(stream, limit)
  const clone = cloner.cloneBodyStream()
  const collected = []
  for await (const chunk of clone) collected.push(chunk)
  const buffered = Buffer.concat(collected)
  return {
    requestBytes: body.length,
    bufferedBytes: buffered.length,
    request: new NextRequest('http://127.0.0.1/api/content/upload', {
      method: 'POST', body: buffered, headers: { 'Content-Type': request.headers.get('Content-Type') },
    }),
  }
}

async function main() {
  const configFile = path.join(temp, 'next-config.mjs')
  fs.writeFileSync(configFile, ts.transpileModule(fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText)
  const config = (await import(pathToFileURL(configFile).href)).default
  const configuredLimit = bytes.parse(config.experimental?.proxyClientMaxBodySize)
  await scenario('Proxy config includes bounded multipart headroom', () => {
    assert.equal(config.experimental.proxyClientMaxBodySize, '51mb')
    assert.equal(configuredLimit, helper.MAX_CONTENT_VIDEO_BYTES + 1024 * 1024)
    assert.equal(defaultConfig.experimental.proxyClientMaxBodySize, 10 * 1024 * 1024)
  })

  await scenario('Authentication rejects a real malformed multipart request before parsing', async () => {
    auth.allowed = false
    const request = new NextRequest('http://127.0.0.1/api/content/upload', {
      method: 'POST', body: 'not multipart', headers: { 'Content-Type': 'multipart/form-data; boundary=fixture' },
    })
    let parsed = false
    request.formData = async () => { parsed = true; throw new Error('Should not parse') }
    assert.deepEqual(await post(request), { status: 401, body: { error: 'Unauthorized' } })
    assert.equal(parsed, false)
    assert.equal(savedCount(), 0)
    auth.allowed = true
  })

  await scenario('Real PNG multipart saves and serves identical bytes', async () => {
    await assertSaved(await post(multipart(new File([png], 'pixel.png', { type: 'image/png' }))), png, 'image/png')
  })
  await scenario('Real MP4 multipart saves and serves identical bytes', async () => {
    await assertSaved(await post(multipart(new File([mp4], 'clip.mp4', { type: 'video/mp4' }))), mp4, 'video/mp4')
  })
  for (const [mime, extension] of [['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif'], ['image/avif', '.avif'], ['video/webm', '.webm'], ['video/ogg', '.ogv']]) {
    await scenario('Supported MIME maps to safe stored extension: ' + mime, async () => {
      const result = await post(multipart(new File([png], 'untrusted-name.html', { type: mime })))
      await assertSaved(result, png, mime)
      assert.equal(path.extname(result.body.filename), extension)
    })
  }
  await scenario('Missing file is rejected without writes', () => assertRejected(undefined, /Chưa chọn tệp/))
  await scenario('String field cannot masquerade as file', () => assertRejected('not a file', /Chưa chọn tệp/))
  await scenario('Empty file is rejected without writes', () => assertRejected(new File([], 'empty.png', { type: 'image/png' }), /Tệp rỗng/))
  await scenario('Unsupported MIME is rejected without writes', () => assertRejected(new File([png], 'page.html', { type: 'text/html' }), /Chỉ hỗ trợ/))
  await scenario('Image exactly 8MiB remains accepted', async () => {
    const value = Buffer.alloc(helper.MAX_CONTENT_IMAGE_BYTES, 0x5a)
    await assertSaved(await post(multipart(new File([value], 'boundary.png', { type: 'image/png' }))), value, 'image/png')
  })
  await scenario('Image over 8MiB is rejected without writes', () => assertRejected(new File([new Uint8Array(helper.MAX_CONTENT_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' }), /Ảnh vượt quá 8MB/))

  await scenario('Actual Next default body cloner truncates a permitted 12MiB video', async () => {
    const before = savedCount()
    const warnings = []
    const warn = console.warn
    console.warn = message => warnings.push(String(message))
    let cloned
    try { cloned = await cloneMultipart(new File([new Uint8Array(12 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' })) }
    finally { console.warn = warn }
    assert.equal(cloned.bufferedBytes, 10 * 1024 * 1024)
    assert.ok(cloned.requestBytes > cloned.bufferedBytes)
    assert.ok(warnings.some(message => /Request body exceeded 10MB/.test(message)))
    assert.equal((await post(cloned.request)).status, 400)
    assert.equal(savedCount(), before)
  })
  await scenario('Configured Next body cloner preserves the same 12MiB video', async () => {
    const value = Buffer.alloc(12 * 1024 * 1024, 0x7a)
    const cloned = await cloneMultipart(new File([value], 'large.mp4', { type: 'video/mp4' }), configuredLimit)
    assert.equal(cloned.bufferedBytes, cloned.requestBytes)
    await assertSaved(await post(cloned.request), value, 'video/mp4')
  })
  await scenario('Video exactly 50MiB plus real multipart headers survives configured Proxy', async () => {
    const value = Buffer.alloc(helper.MAX_CONTENT_VIDEO_BYTES, 0x31)
    const cloned = await cloneMultipart(new File([value], 'boundary.mp4', { type: 'video/mp4' }), configuredLimit)
    assert.ok(cloned.requestBytes > helper.MAX_CONTENT_VIDEO_BYTES)
    assert.ok(cloned.requestBytes < configuredLimit)
    assert.equal(cloned.bufferedBytes, cloned.requestBytes)
    await assertSaved(await post(cloned.request), value, 'video/mp4')
  })
  await scenario('Video over 50MiB is still rejected by API after intact Proxy parsing', async () => {
    const before = savedCount()
    const cloned = await cloneMultipart(new File([new Uint8Array(helper.MAX_CONTENT_VIDEO_BYTES + 1)], 'large.mp4', { type: 'video/mp4' }), configuredLimit)
    assert.equal(cloned.bufferedBytes, cloned.requestBytes)
    const result = await post(cloned.request)
    assert.equal(result.status, 400)
    assert.match(result.body.error, /Video vượt quá 50MB/)
    assert.equal(savedCount(), before)
  })
  await scenario('Authenticated malformed multipart returns error without writing files', async () => {
    const before = savedCount()
    const request = new NextRequest('http://127.0.0.1/api/content/upload', {
      method: 'POST', body: 'not multipart', headers: { 'Content-Type': 'multipart/form-data; boundary=fixture' },
    })
    assert.equal((await post(request)).status, 400)
    assert.equal(savedCount(), before)
  })
  await scenario('Media serving refuses traversal and missing files', async () => {
    for (const parts of [['..', 'pixel.png'], ['nested', 'pixel.png'], ['pixel.svg'], ['codex-missing.png']]) {
      const response = await mediaRoute.GET(new Request('http://127.0.0.1/uploads/content/fixture'), { params: Promise.resolve({ path: parts }) })
      assert.equal(response.status, 404)
    }
  })
  console.log(`RESULT=PASS scenarios=${scenarios} multipart=real filesystem=real auth=stub proxy-clone=installed-next`)
}

// A dangling stream promise should fail explicitly rather than silently exiting Node.
const deadline = setTimeout(() => { console.error('RESULT=FAIL upload verification timed out'); process.exit(1) }, 30_000)
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  clearTimeout(deadline)
  if (previousDirectory === undefined) delete process.env.CONTENT_UPLOAD_DIR
  else process.env.CONTENT_UPLOAD_DIR = previousDirectory
  fs.rmSync(temp, { recursive: true, force: true })
})
