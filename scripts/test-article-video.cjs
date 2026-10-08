/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const ts = require('typescript')

const state = { authorized: true, reads: 0, dns: [], network: [], hosts: new Map(), responses: new Map(), timeout: 1000, timeoutArgs: [] }
const originalTimeout = AbortSignal.timeout
AbortSignal.timeout = milliseconds => { state.timeoutArgs.push(milliseconds); return originalTimeout(state.timeout) }
const cache = new Map()
const publicDns = [{ address: '8.8.8.8', family: 4 }]
function reset() {
  state.authorized = true; state.reads = 0; state.dns = []; state.network = []; state.hosts.clear(); state.responses.clear(); state.timeout = 1000; state.timeoutArgs = []
}
function mockGet(url, options, callback) {
  const href = url.href
  const request = new EventEmitter()
  const abort = () => request.emit('error', new Error('Fixture abort'))
  options.signal.addEventListener('abort', abort, { once: true })
  let pinned
  options.lookup(url.hostname, { all: false }, (error, address, family) => { assert.equal(error, null); pinned = { address, family } })
  const call = { url: href, options, pinned, destroyed: false }
  state.network.push(call)
  queueMicrotask(() => {
    const fixture = state.responses.get(href)
    if (!fixture) { options.signal.removeEventListener('abort', abort); request.emit('error', new Error('Unexpected fixture URL')); return }
    if (fixture.error) { options.signal.removeEventListener('abort', abort); request.emit('error', fixture.error); return }
    if (fixture.hangHeaders) return
    const response = new EventEmitter()
    response.statusCode = fixture.status ?? 200
    response.headers = { 'content-type': 'text/html; charset=UTF-8', ...fixture.headers }
    response.complete = false
    response.destroy = () => { call.destroyed = true; queueMicrotask(() => response.emit('close')) }
    callback(response)
    if (call.destroyed) { options.signal.removeEventListener('abort', abort); return }
    if (fixture.hangBody) return
    queueMicrotask(() => {
      if (fixture.event) { response.emit(fixture.event, new Error('Fixture response event')); options.signal.removeEventListener('abort', abort); return }
      for (const chunk of fixture.chunks || [Buffer.from(fixture.html || '')]) {
        if (call.destroyed) break
        response.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      if (!call.destroyed) { response.complete = fixture.complete !== false; response.emit('end'); response.emit('close') }
      options.signal.removeEventListener('abort', abort)
    })
  })
  return request
}
function load(file) {
  if (!path.extname(file)) file += '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }; cache.set(file, fixture)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  const resolve = id => {
    if (id === 'node:https') return { get: mockGet }
    if (id === 'node:dns/promises') return { lookup: async (host, options) => {
      state.dns.push({ host, options })
      const value = state.hosts.get(host)
      if (value instanceof Error) throw value
      if (value === 'never') return new Promise(() => {})
      return value || publicDns
    } }
    if (id === '@/lib/content-management') return { getManagedContentUserId: async () => state.authorized ? 'fixture-user' : null }
    if (id.startsWith('@/')) return load(path.resolve(id.slice(2)))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(resolve, fixture, fixture.exports)
  return fixture.exports
}
const helper = load(path.resolve('lib/article-video.ts'))
const route = load(path.resolve('app/api/content/resolve-video/route.ts'))
const article = 'https://article.example/posts/story'
const media = 'https://cdn.example/clip.mp4?token=A+B%2f%2F&same=1&same=2&empty=&checksum=x%3D%3D'
const htmlVideo = value => '<figure><video src="' + value.replaceAll('&', '&amp;') + '"></video></figure>'
async function resolve(url, brokenJson = false) {
  const response = await route.POST({ json: async () => { state.reads++; if (brokenJson) throw new Error('Fixture JSON'); return { url } } })
  return { status: response.status, body: await response.json() }
}
const tests = []
function scenario(name, fn) { tests.push({ name, fn }) }
function setArticle(html, extras = {}) { state.responses.set(article, { html, ...extras }) }

scenario('authenticated API reads static MP4 and preserves complete signed query without media download', async () => {
  reset(); setArticle(htmlVideo(media))
  assert.deepEqual(await resolve(article), { status: 200, body: { url: media, kind: 'video' } })
  assert.deepEqual(state.network.map(item => item.url), [article])
  assert.deepEqual(state.dns.map(item => item.host), ['article.example', 'cdn.example'])
  assert.equal(state.network[0].options.agent, false)
  assert.equal(state.network[0].options.family, 4)
  assert.deepEqual(state.network[0].pinned, publicDns[0])
  assert.equal(state.network[0].options.headers['accept-encoding'], 'identity')
  assert.equal(state.timeoutArgs[0], 10_000)
})
scenario('authentication happens before JSON parsing DNS or HTTPS requests', async () => {
  reset(); state.authorized = false
  assert.equal((await resolve(article, true)).status, 401)
  assert.equal(state.reads, 0); assert.equal(state.dns.length, 0); assert.equal(state.network.length, 0)
})
for (const bad of [null, '', '/relative', 'http://article.example/a', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@article.example/a', 'https://article.example:8443/a', 'https://article.example/\na', 'https://article.example\\a', 'https://article.example/' + 'x'.repeat(8192)]) {
  scenario('invalid URL fails 400 before DNS/network: ' + String(bad).slice(0, 45), async () => {
    reset(); assert.equal((await resolve(bad)).status, 400)
    assert.equal(state.dns.length, 0); assert.equal(state.network.length, 0)
  })
}
scenario('malformed JSON fails 400 without DNS/network', async () => {
  reset(); assert.equal((await resolve(article, true)).status, 400); assert.equal(state.network.length, 0); assert.equal(state.dns.length, 0)
})
scenario('only real video/source attributes are extracted in document order', () => {
  const html = '<source src="https://cdn.example/outside.mp4"><!--' + htmlVideo('https://cdn.example/comment.mp4') + '-->'
    + '<script>const data=\'' + htmlVideo('https://cdn.example/script.mp4') + '\';</script>'
    + '<style>' + htmlVideo('https://cdn.example/style.mp4') + '</style>'
    + '<textarea>' + htmlVideo('https://cdn.example/textarea.mp4') + '</textarea>'
    + '<title>' + htmlVideo('https://cdn.example/title.mp4') + '</title>'
    + '<iframe>' + htmlVideo('https://cdn.example/frame.mp4') + '</iframe>'
    + '<template>' + htmlVideo('https://cdn.example/template.mp4') + '</template>'
    + '<video src="blob:fixture" data-src="https://cdn.example/a.m3u8"><source data-lazy-src="/video.webm?key=1+2&amp;same=1&amp;same=2"></video>'
    + '<video data-lazy-src="https://cdn.example/second.ogg"></video>'
  assert.deepEqual(helper.extractArticleVideoUrls(html, article), ['https://article.example/video.webm?key=1+2&same=1&same=2', 'https://cdn.example/second.ogg'])
})
for (const tag of ['xmp', 'noembed', 'noframes', 'noscript', 'svg', 'math']) scenario('raw/inert ' + tag + ' does not contribute fake video', () => {
  assert.deepEqual(helper.extractArticleVideoUrls('<' + tag + '>' + htmlVideo('https://cdn.example/fake.mp4') + '</' + tag + '>' + htmlVideo(media), article), [media])
})
scenario('plaintext suppresses all remaining markup including a literal closing tag', () => {
  assert.deepEqual(helper.extractArticleVideoUrls('<plaintext>text</plaintext>' + htmlVideo(media), article), [])
})
scenario('HTML entities decode exactly once and URLs are deduplicated without changing query bytes', () => {
  const value = 'https://cdn.example/a.mp4?literal=&amp;safe=1&token=A+B%2f&same=1&same=2'
  const escaped = value.replaceAll('&', '&amp;')
  assert.deepEqual(helper.extractArticleVideoUrls('<video src="' + escaped + '"><source src="' + escaped + '"></video>', article), [value])
})
scenario('query that URL serialization changes is skipped rather than silently rewritten', () => {
  assert.deepEqual(helper.extractArticleVideoUrls('<video src="https://cdn.example/a.mp4?signature=x&#39;y"></video>' + htmlVideo(media), article), [media])
})
scenario('relative source uses final redirect document URL and valid first base href', async () => {
  reset()
  state.responses.set(article, { status: 302, headers: { location: '/new/path/' } })
  state.responses.set('https://article.example/new/path/', { html: '<base href="../media/"><base href="https://ignored.example/"><video><source src="clip.mp4?token=A+B%2f&amp;same=1&amp;same=2"></video>' })
  assert.deepEqual(await resolve(article), { status: 200, body: { url: 'https://article.example/new/media/clip.mp4?token=A+B%2f&same=1&same=2', kind: 'video' } })
  assert.deepEqual(state.network.map(item => item.url), [article, 'https://article.example/new/path/'])
  assert.equal(state.network[0].options.signal, state.network[1].options.signal)
})
scenario('malformed first base leaves document resolution available, including absolute videos', () => {
  assert.deepEqual(helper.extractArticleVideoUrls('<base href="https://[broken"><video src="/clip.mp4"></video>' + htmlVideo(media), article), ['https://article.example/clip.mp4', media])
})
scenario('unsupported manifests iframe opaque sources and no candidates produce safe 422', async () => {
  reset(); setArticle('<iframe src="https://cdn.example/a.mp4"></iframe><video src="https://cdn.example/a.m3u8"></video><video src="https://cdn.example/no-extension"></video>')
  const result = await resolve(article); assert.equal(result.status, 422); assert.match(result.body.error, /Không tìm thấy video/)
  assert.equal(state.network.length, 1); assert.equal(state.dns.length, 1); assert.doesNotMatch(result.body.error, /article\.example|<video/)
})
for (const host of ['127.0.0.1', '2130706433', '0x7f000001', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '[::1]', '[fd00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '[2002:7f00:1::]', '[64:ff9b::7f00:1]']) {
  scenario('private/special literal input never reaches a socket: ' + host, async () => {
    reset(); assert.equal((await resolve('https://' + host + '/story')).status, 422)
    assert.equal(state.network.length, 0); assert.equal(state.dns.length, 0)
  })
}
scenario('every DNS answer must be public before the article socket is created', async () => {
  reset(); state.hosts.set('article.example', [publicDns[0], { address: '127.0.0.1', family: 4 }])
  assert.equal((await resolve(article)).status, 422); assert.equal(state.network.length, 0)
})
scenario('public IPv6 socket uses the validated DNS family and pinned address', async () => {
  reset(); state.hosts.set('article.example', [{ address: '2606:4700:4700::1111', family: 6 }]); setArticle(htmlVideo(media))
  assert.equal((await resolve(article)).status, 200)
  assert.deepEqual(state.network[0].pinned, { address: '2606:4700:4700::1111', family: 6 })
})
scenario('private or unavailable video candidates are skipped until the first public direct source', async () => {
  reset(); state.hosts.set('private.example', [{ address: '10.0.0.1', family: 4 }]); state.hosts.set('dead.example', new Error('ENOTFOUND'))
  setArticle(htmlVideo('https://127.0.0.1/bad.mp4') + htmlVideo('https://private.example/bad.webm') + htmlVideo('https://dead.example/bad.ogg') + htmlVideo(media))
  assert.deepEqual(await resolve(article), { status: 200, body: { url: media, kind: 'video' } }); assert.deepEqual(state.network.map(item => item.url), [article])
})
scenario('mixed DNS video candidates are skipped without fetching any media', async () => {
  reset(); state.hosts.set('mixed.example', [publicDns[0], { address: '::1', family: 6 }]); setArticle(htmlVideo('https://mixed.example/a.mp4') + htmlVideo(media))
  assert.equal((await resolve(article)).body.url, media); assert.equal(state.network.length, 1)
})
scenario('private redirect is refused before a next-hop socket', async () => {
  reset(); state.responses.set(article, { status: 302, headers: { location: 'https://127.0.0.1/secret' } })
  assert.equal((await resolve(article)).status, 422); assert.deepEqual(state.network.map(item => item.url), [article]); assert.equal(state.network[0].destroyed, true)
})
for (const location of ['http://public.example/story', 'https://user:pass@public.example/story', 'https://public.example:9443/story']) scenario('unsafe redirect URL is refused: ' + location, async () => {
  reset(); state.responses.set(article, { status: 302, headers: { location } }); assert.equal((await resolve(article)).status, 422); assert.equal(state.network.length, 1)
})
scenario('three redirects succeed and a fourth is bounded without fetching its destination', async () => {
  reset()
  const hops = [article, article + '/1', article + '/2', article + '/3']
  hops.slice(0, -1).forEach((url, index) => state.responses.set(url, { status: 302, headers: { location: hops[index + 1] } }))
  state.responses.set(hops[3], { html: htmlVideo(media) }); assert.equal((await resolve(article)).status, 200); assert.equal(state.network.length, 4)
  state.network = []; state.responses.set(hops[3], { status: 302, headers: { location: article + '/4' } })
  assert.equal((await resolve(article)).status, 422); assert.equal(state.network.length, 4)
})
for (const fixture of [{ headers: { 'content-type': 'video/mp4' } }, { headers: { 'content-length': '500001' } }, { headers: { 'content-encoding': 'gzip' } }, { chunks: [Buffer.alloc(250000), Buffer.alloc(250001)] }]) scenario('non-HTML/encoded/oversize article is stopped without interpreting its body', async () => {
  reset(); setArticle(htmlVideo(media), fixture); assert.equal((await resolve(article)).status, 422); assert.equal(state.network[0].destroyed, true)
})
for (const event of ['aborted', 'close', 'error']) scenario('incomplete HTTP response ' + event + ' rejects safely', async () => {
  reset(); setArticle(htmlVideo(media), { event }); assert.equal((await resolve(article)).status, 502)
})
scenario('response end before HTTP completion is not accepted as an article', async () => {
  reset(); setArticle(htmlVideo(media), { complete: false }); assert.equal((await resolve(article)).status, 502)
})
for (const blocked of ['dns', 'headers', 'body', 'video-dns']) scenario('overall deadline covers stalled ' + blocked, async () => {
  reset(); state.timeout = 20
  if (blocked === 'dns') state.hosts.set('article.example', 'never')
  else if (blocked === 'video-dns') { state.hosts.set('cdn.example', 'never'); setArticle(htmlVideo(media)) }
  else setArticle(htmlVideo(media), { [blocked === 'headers' ? 'hangHeaders' : 'hangBody']: true })
  const result = await Promise.race([resolve(article), new Promise((_, reject) => setTimeout(() => reject(new Error('Fixture deadline not enforced')), 200))])
  assert.equal(result.status, 504); assert.match(result.body.error, /Hết thời gian/)
})
scenario('upstream errors are safe and disclose neither URL nor raw exception', async () => {
  reset(); state.responses.set(article, { error: new Error('secret URL/credential fixture') })
  const result = await resolve(article); assert.equal(result.status, 502); assert.doesNotMatch(result.body.error, /secret|credential|article\.example/)
})

;(async () => {
  for (const test of tests) { await test.fn(); console.log('PASS ' + test.name) }
  console.log('RESULT=PASS article-video-scenarios=' + tests.length)
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { AbortSignal.timeout = originalTimeout })
