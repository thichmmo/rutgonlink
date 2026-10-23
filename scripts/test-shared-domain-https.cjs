/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const { NextURL } = require('next/dist/server/web/next-url')
const { stripInternalSearchParams } = require('next/dist/server/internal-utils')
const { searchParamsToUrlQuery, urlQueryToSearchParams } = require('next/dist/shared/lib/router/utils/querystring')

process.env.NODE_ENV = 'production'
process.env.NEXTAUTH_URL = 'https://rutgonlink.site'
process.env.APP_ALLOWED_HOSTS = 'existing-app-alias.example'
process.env.VPS_HOST = 'existing-vps.example'
let token = null
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }
  cache.set(file, fixture)
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const localRequire = id => id === 'next-auth/jwt' ? { getToken: async () => token }
    : id.startsWith('@/') ? load(id.slice(2) + '.ts') : require(id)
  new Function('require', 'module', 'exports', code)(localRequire, fixture, fixture.exports)
  return fixture.exports
}
const { proxy } = load('proxy.ts')
const { SHARED_DOMAINS } = load('lib/shared-domains.ts')
const { isMainAppHostname } = load('lib/site-config.ts')
let networkCalls = 0
global.fetch = async () => { networkCalls++; throw new Error('Transport tests must not send network requests') }
const query = '?affiliate=A+B%2f&affiliate=second&encoded=%26%3d&empty=&url=https%3A%2F%2Fexample.invalid%2F'
function request(host, pathname = '/p7/61720', options = {}) {
  const headers = { host, 'user-agent': 'curl/transport-fixture', 'cf-connecting-ip': '127.0.0.1', ...options.headers }
  if (options.visitor !== undefined) headers['cf-visitor'] = options.visitor
  return new NextRequest(options.url || `http://${host}${pathname}`, { method: options.method || 'GET', headers })
}
function next(response) {
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('location'), null)
}
function redirected(response, expected) {
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('location'), expected)
}
let scenarios = 0
async function scenario(name, run) { token = null; await run(); scenarios++; console.log('PASS ' + name) }

;(async () => {
  await scenario('each configured shared domain upgrades edge HTTP on its own host', async () => {
    for (const host of SHARED_DOMAINS) {
      assert.equal(isMainAppHostname(host), false, 'Shared domains do not become application hosts')
      redirected(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"http"}' })), `https://${host}/p7/61720`)
    }
  })
  await scenario('query bytes and encoded path received by the proxy stay unchanged', async () => {
    const host = SHARED_DOMAINS[0], pathname = '/p7/61720/%2f%5C%20' + query
    redirected(await proxy(request(host, pathname, { visitor: '{"scheme":"http"}' })), `https://${host}${pathname}`)
  })
  await scenario('Next normalization preserves query values and nested signed URL before proxy redirect', async () => {
    const host = SHARED_DOMAINS[0]
    const nested = 'https://affiliate.example.invalid/product/123?signature=A+B%2f%2b&part=one&part=two&empty='
    const external = new URL(`http://${host}/p7/61720?signed=A+B%2f&position=middle&signed=two&empty=&space=%20~&affiliate=${encodeURIComponent(nested)}`)
    const received = new NextURL(external.href)
    // Next rebuilds parsed queries, then the adapter removes internal search
    // parameters. Use the installed helpers rather than bypassing that boundary.
    received.search = urlQueryToSearchParams(searchParamsToUrlQuery(external.searchParams)).toString()
    stripInternalSearchParams(received)
    assert.notEqual(received.search, external.search, 'Default Next normalization is not externally byte-exact')
    assert.ok(received.search.includes('signed=A+B%2F'))
    assert.ok(received.search.includes('space=+%7E'))
    const response = await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"http"}', url: received.href }))
    redirected(response, `https://${host}/p7/61720${received.search}`)
    const destination = new URL(response.headers.get('location'))
    for (const key of new Set(external.searchParams.keys())) {
      assert.deepEqual(destination.searchParams.getAll(key), external.searchParams.getAll(key), `Decoded values/order for ${key} remain intact`)
    }
    assert.deepEqual(destination.searchParams.getAll('signed'), ['A B/', 'two'])
    assert.equal(destination.searchParams.get('empty'), '')
    assert.equal(destination.searchParams.get('affiliate'), nested, 'Nested signed URL retains its complete inner byte string')
  })
  await scenario('scheme-relative-looking path cannot change the allowlisted destination host', async () => {
    const host = SHARED_DOMAINS[0], pathname = '//outside.invalid/path' + query
    const response = await proxy(request(host, pathname, { visitor: '{"scheme":"http"}' }))
    redirected(response, `https://${host}${pathname}`)
    assert.equal(new URL(response.headers.get('location')).hostname, host)
  })
  await scenario('internal Passenger origin/port does not leak into the HTTPS public destination', async () => {
    const host = SHARED_DOMAINS[0]
    redirected(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"http"}', url: 'http://127.0.0.1:3000/p7/61720' + query })), `https://${host}/p7/61720${query}`)
  })
  await scenario('HEAD and POST use method-preserving 308 rather than a temporary 302', async () => {
    const host = SHARED_DOMAINS[0]
    for (const method of ['HEAD', 'POST']) {
      const response = await proxy(request(host, '/p7/61720', { method, visitor: '{"scheme":"http"}' }))
      redirected(response, `https://${host}/p7/61720`)
      assert.equal(await response.text(), '')
    }
  })
  await scenario('HTTPS edge visitors do not loop when Passenger reports an internal HTTP URL', async () => {
    const host = SHARED_DOMAINS[0]
    next(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"https"}', headers: { 'x-forwarded-proto': 'http' }, url: 'http://127.0.0.1:3000/p7/61720' })))
    next(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"https"}', url: `https://${host}/p7/61720` })))
  })
  await scenario('missing malformed and non-HTTP edge schemes leave plain HTTP behavior unchanged', async () => {
    for (const visitor of [undefined, '', 'invalid-json', 'null', '{}', '[]', '"http"', '{"scheme":null}', '{"scheme":42}', '{"scheme":"HTTP"}', '{"scheme":"ftp"}']) {
      next(await proxy(request(SHARED_DOMAINS[0], '/p7/61720', { visitor, headers: { 'x-forwarded-proto': 'http' } })))
    }
  })
  await scenario('local development hosts remain HTTP even with an edge HTTP signal', async () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000']) next(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"http"}' })))
  })
  await scenario('unknown custom and lookalike Hosts never receive an HTTPS redirect', async () => {
    for (const host of ['unknown.example', 'verified-custom.example', 'www.' + SHARED_DOMAINS[0], SHARED_DOMAINS[0] + '.outside.invalid', 'outside-' + SHARED_DOMAINS[0]]) {
      next(await proxy(request(host, '/p7/61720', { visitor: '{"scheme":"http"}' })))
    }
  })
  await scenario('main primary www and configured aliases retain existing canonical destinations', async () => {
    redirected(await proxy(request('rutgonlink.site', '/p7/61720' + query, { visitor: '{"scheme":"http"}' })), 'https://rutgonlink.site/p7/61720' + query)
    for (const host of ['www.rutgonlink.site', 'existing-app-alias.example']) {
      redirected(await proxy(request(host, '/p7/61720' + query, { visitor: '{"scheme":"https"}' })), 'https://rutgonlink.site/p7/61720' + query)
    }
    next(await proxy(request('rutgonlink.site', '/p7/61720', { visitor: '{"scheme":"https"}' })))
    next(await proxy(request('rutgonlink.site', '/p7/61720')))
  })
  await scenario('shared domain private API dashboard root and asset guards remain blocked after upgrade', async () => {
    const host = SHARED_DOMAINS[0]
    for (const pathname of ['/api/posts', '/api/admin/users', '/dashboard', '/login', '/register', '/', '/_next/private', '/favicon.ico']) {
      redirected(await proxy(request(host, pathname, { visitor: '{"scheme":"http"}' })), `https://${host}${pathname}`)
      const response = await proxy(request(host, pathname, { visitor: '{"scheme":"https"}', url: `https://${host}${pathname}` }))
      assert.equal(response.status, 404); assert.equal(response.headers.get('location'), null)
    }
  })
  await scenario('public click beacon remains POST-only and keeps same-origin API restrictions', async () => {
    const host = SHARED_DOMAINS[0]
    redirected(await proxy(request(host, '/api/popup-clicks', { method: 'POST', visitor: '{"scheme":"http"}' })), `https://${host}/api/popup-clicks`)
    next(await proxy(request(host, '/api/popup-clicks', { method: 'POST', visitor: '{"scheme":"https"}' })))
    assert.equal((await proxy(request(host, '/api/popup-clicks', { visitor: '{"scheme":"https"}' }))).status, 404)
    assert.equal((await proxy(request(host, '/api/posts', { method: 'POST', visitor: '{"scheme":"https"}' }))).status, 404)
    assert.equal((await proxy(request('unknown.example', '/api/posts', { visitor: '{"scheme":"http"}' }))).status, 404)
  })
  await scenario('main dashboard authentication and normal main-domain APIs keep existing behavior', async () => {
    const host = 'rutgonlink.site'
    const response = await proxy(request(host, '/dashboard', { visitor: '{"scheme":"https"}', url: 'https://rutgonlink.site/dashboard' }))
    assert.equal(response.status, 307); assert.equal(response.headers.get('location'), 'https://rutgonlink.site/login')
    token = { sub: 'fixture-user' }
    next(await proxy(request(host, '/dashboard', { visitor: '{"scheme":"https"}' })))
    next(await proxy(request(host, '/api/posts', { visitor: '{"scheme":"https"}' })))
  })
  await scenario('redirect decision is independent of Facebook and ordinary browser UA', async () => {
    for (const ua of ['facebookexternalhit/1.1', 'Facebot', 'Mozilla/5.0 Chrome/140', 'Mozilla/5.0 Android [FBAN/FB4A]', '']) {
      redirected(await proxy(request(SHARED_DOMAINS[0], '/p7/61720', { visitor: '{"scheme":"http"}', headers: { 'user-agent': ua } })), `https://${SHARED_DOMAINS[0]}/p7/61720`)
    }
  })
  assert.equal(networkCalls, 0, 'Fixture requests must not dispatch telemetry or external fetches')
  console.log('RESULT=PASS shared-domain-https-scenarios=' + scenarios)
})().catch(error => { console.error(error); process.exitCode = 1 })
