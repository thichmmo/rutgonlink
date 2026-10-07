/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

// The API's Vietnam day must remain visible from a browser in another timezone.
process.env.TZ = 'America/Los_Angeles'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.example/admin/users', pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const cache = new Map()
let navigationQuery = new URLSearchParams()
let navigationId = 'user-alpha'
function load(file) {
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const fixture = { exports: {} }
  cache.set(file, fixture)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = id => {
    if (id === 'next/link') return props => React.createElement('a', props, props.children)
    if (id === 'next/navigation') return { useSearchParams: () => navigationQuery, useParams: () => ({ id: navigationId }) }
    if (id.startsWith('@/')) return load(path.resolve(id.slice(2)))
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id))
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(resolve, fixture, fixture.exports)
  return fixture.exports
}
const root = createRoot(document.querySelector('#root'))
const calls = []
const counts = { shopee: 7, tiktok: 3, total: 10 }
const basicUser = (id, popupClicksToday = { shopee: 0, tiktok: 0, total: 0 }) => ({
  id, numericId: id === 'user-alpha' ? 101 : 102, name: id, email: id + '@fixture.example', loginType: 'password', status: 'active', adminRole: null,
  plan: 'free', planExpiresAt: null, lastLoginAt: null, createdAt: '2026-10-01T00:00:00.000Z', linkCount: 2, domainCount: 1, paymentCount: 0, clickCount: 9123,
  ...(popupClicksToday === null ? {} : { popupClicksToday }),
})
let listData
let listError
let detailData
let detailError
let pendingListRequests = null
let pendingDetailRequests = null
function resetListData() {
  listError = null
  listData = { users: [basicUser('user-alpha', counts), basicUser('user-beta'), basicUser('user-legacy', null)], total: 45, page: 1, pages: 3,
    summary: { statuses: { active: 45 }, plans: { free: 45 } }, popupClicksTodayAsOf: '2026-10-07T18:30:00.000Z', popupClicksTimezone: 'Asia/Ho_Chi_Minh' }
}
const response = (data, ok = true) => ({ ok, json: async () => data })
global.fetch = async (url, init = {}) => {
  calls.push({ url, ...init })
  if (url.startsWith('/api/admin/users?')) {
    if (pendingListRequests) {
      let resolve, reject
      const promise = new Promise((done, fail) => { resolve = done; reject = fail })
      pendingListRequests.push({ url, resolve, reject })
      return promise
    }
    return listError ? response({ error: listError }, false) : response(listData)
  }
  if (/^\/api\/admin\/users\/[\w-]+$/.test(url)) {
    if (pendingDetailRequests) {
      let resolve, reject
      const promise = new Promise((done, fail) => { resolve = done; reject = fail })
      pendingDetailRequests.push({ url, resolve, reject })
      return promise
    }
    if (detailError instanceof Error) throw detailError
    return detailError ? response({ error: detailError }, false) : response(detailData)
  }
  throw new Error('Unexpected fetch ' + url)
}
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text)
const popupCell = id => document.querySelector('[aria-label="Click popup hôm nay của ' + id + '@fixture.example"]')
async function click(element) { assert.ok(element, 'Click target exists'); await React.act(async () => element.click()) }
async function input(element, value) {
  assert.ok(element, 'Input target exists')
  const proto = element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
async function mount(Component) { await React.act(async () => root.render(React.createElement(Component, { key: Math.random() }))) }
let assertions = 0
function check(fn) { fn(); assertions++ }
async function testList() {
  resetListData()
  navigationQuery = new URLSearchParams('status=active')
  const Users = load(path.resolve('app/admin/users/page.tsx')).default
  await mount(Users)
  check(() => assert.equal(new URL(calls.at(-1).url, dom.window.location.origin).searchParams.get('status'), 'active'))
  check(() => assert.match(document.querySelector('thead').textContent, /Click popup hôm nay/))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 10Shopee: 7TikTok: 3/))
  check(() => assert.match(popupCell('user-beta').textContent, /Tổng 0Shopee: 0TikTok: 0/))
  check(() => assert.equal(popupCell('user-legacy').textContent, 'Chưa có dữ liệu'))
  check(() => assert.doesNotMatch(popupCell('user-legacy').textContent, /\b0\b/))
  check(() => assert.match(popupCell('user-alpha').closest('tr').textContent, /9[,.]123 click link toàn thời gian/))
  check(() => assert.match(document.body.textContent, /UTC\+7/))
  check(() => assert.match(document.body.textContent, /01:30:00 8\/10\/2026/, 'Snapshot date/time uses Vietnam timezone, not local browser timezone'))
  check(() => assert.equal(document.querySelector('a[href="/admin/users/user-alpha"]')?.textContent.trim(), 'Chi tiết'))
  check(() => assert.equal(calls.filter(call => call.method && call.method !== 'GET').length, 0, 'List remains read-only'))

  const initialCalls = calls.length
  listData = { ...listData, users: [basicUser('user-alpha', { shopee: 8, tiktok: 5, total: 13 })], popupClicksTodayAsOf: '2026-10-07T19:00:00.000Z' }
  await click(button('Cập nhật'))
  check(() => assert.equal(calls.length, initialCalls + 1))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 13Shopee: 8TikTok: 5/))
  check(() => assert.match(document.body.textContent, /02:00:00 8\/10\/2026/))
  check(() => assert.equal(calls.at(-1).cache, 'no-store'))

  const selects = document.querySelectorAll('select')
  await input(selects[1], 'pro')
  await input(selects[2], 'google')
  await input(document.querySelector('input[placeholder="Email, tên hoặc ID"]'), 'alpha')
  let query = new URL(calls.at(-1).url, dom.window.location.origin).searchParams
  check(() => assert.equal(query.get('search'), 'alpha'))
  check(() => assert.equal(query.get('plan'), 'pro'))
  check(() => assert.equal(query.get('loginType'), 'google'))
  check(() => assert.equal(query.get('status'), 'active'))
  check(() => assert.equal(query.get('page'), '1'))
  await click([...document.querySelectorAll('button')].find(item => item.querySelector('.lucide-chevron-right')))
  check(() => assert.match(document.body.textContent, /Trang 2\/3/))
  const beforeRefreshUrl = calls.at(-1).url
  await click(button('Cập nhật'))
  check(() => assert.equal(calls.at(-1).url, beforeRefreshUrl, 'Refresh preserves current filters and page'))
  await input(selects[0], 'suspended')
  query = new URL(calls.at(-1).url, dom.window.location.origin).searchParams
  check(() => assert.equal(query.get('status'), 'suspended'))
  check(() => assert.equal(query.get('page'), '1', 'Changing a filter still resets pagination'))

  listError = 'Forbidden'
  await click(button('Cập nhật'))
  check(() => assert.match(document.body.textContent, /Forbidden/))
  check(() => assert.equal(document.querySelector('table'), null, 'Permission/API errors do not display stale counts as current'))
  listError = null
  listData = { ...listData, users: [], total: 0, pages: 1 }
  await click(button('Cập nhật'))
  check(() => assert.match(document.body.textContent, /Không có dữ liệu/))
  check(() => assert.equal(document.querySelector('table'), null))
  console.log('PASS admin user list popup today counts, snapshot timezone, refresh and filters')
}

async function testListOverlaps() {
  resetListData()
  navigationQuery = new URLSearchParams()
  const Users = load(path.resolve('app/admin/users/page.tsx')).default
  await mount(Users)
  pendingListRequests = []
  const selects = document.querySelectorAll('select')
  const snapshot = total => ({ ...listData, users: [basicUser('user-alpha', { shopee: total - 1, tiktok: 1, total })], popupClicksTodayAsOf: '2026-10-07T20:00:00.000Z' })

  await input(selects[1], 'pro')
  await input(selects[1], 'ultra')
  check(() => assert.equal(pendingListRequests.length, 2))
  await React.act(async () => pendingListRequests[0].resolve(response(snapshot(99))))
  check(() => assert.equal(document.querySelector('table'), null, 'Older completion must not release the latest loading state'))
  check(() => assert.equal(button('Cập nhật').disabled, true))
  await React.act(async () => pendingListRequests[1].resolve(response(snapshot(21))))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 21Shopee: 20TikTok: 1/))
  check(() => assert.equal(selects[1].value, 'ultra'))

  // Resolve headers, but delay JSON until another filter's snapshot is visible.
  await input(selects[0], 'active')
  let finishJson
  const delayedJson = new Promise(done => { finishJson = done })
  await React.act(async () => pendingListRequests[2].resolve({ ok: true, json: () => delayedJson }))
  await input(selects[0], 'suspended')
  await React.act(async () => pendingListRequests[3].resolve(response(snapshot(22))))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 22/))
  await React.act(async () => finishJson(snapshot(98)))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 22/, 'An older parsed body cannot replace the latest filter snapshot'))
  check(() => assert.doesNotMatch(document.body.textContent, /Tổng 98/))

  await click(button('Cập nhật'))
  await click([...document.querySelectorAll('button')].find(item => item.querySelector('.lucide-chevron-right')))
  check(() => assert.equal(new URL(pendingListRequests[5].url, dom.window.location.origin).searchParams.get('page'), '2'))
  await React.act(async () => pendingListRequests[5].resolve(response(snapshot(23))))
  await React.act(async () => pendingListRequests[4].resolve(response(snapshot(97))))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 23/, 'Old manual refresh cannot overwrite a newer page'))
  check(() => assert.match(document.body.textContent, /Trang 2\/3/))

  await click(button('Cập nhật'))
  await input(selects[2], 'google')
  await React.act(async () => pendingListRequests[6].reject(new Error('Stale request failed')))
  check(() => assert.equal(document.querySelector('table'), null, 'An old failure keeps the newer request loading'))
  check(() => assert.doesNotMatch(document.body.textContent, /Stale request failed/))
  await React.act(async () => pendingListRequests[7].resolve(response(snapshot(24))))
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 24/))
  check(() => assert.equal(button('Cập nhật').disabled, false))

  await click(button('Cập nhật'))
  const outstanding = pendingListRequests[8]
  await React.act(async () => root.render(null))
  let parsedAfterUnmount = false
  await React.act(async () => outstanding.resolve({ ok: true, json: async () => { parsedAfterUnmount = true; return snapshot(96) } }))
  check(() => assert.equal(parsedAfterUnmount, false, 'Unmount invalidates an in-flight response before processing its body'))
  check(() => assert.equal(document.querySelector('#root').textContent, ''))
  pendingListRequests = null
  await mount(Users)
  check(() => assert.match(popupCell('user-alpha').textContent, /Tổng 10/, 'A new mount loads its own initial snapshot'))
  console.log('PASS admin user list stale-response/loading/error/unmount guards')
}

function resetDetailData() {
  detailError = null
  detailData = {
    user: { ...basicUser('user-alpha', counts), adminRole: 'support', googleDriveEmail: null, hasApiKey: true, suspendedAt: null, suspensionReason: null, deletedAt: null,
      _count: { links: 2, domains: 1, notes: 0, ownedWorkspaces: 0, payments: 0 } },
    links: [{ id: 'link', shortCode: 'alpha-link', title: 'Lifetime link fixture', originalUrl: 'https://fixture.invalid/landing', isActive: true, disabledByAdmin: false, createdAt: '2026-10-01T00:00:00.000Z', _count: { clicks: 14567 } }],
    domains: [], payments: [], subscriptions: [], workspaces: [], recentActivity: [],
    currentAdmin: { role: 'owner', permissions: ['users.read', 'users.write', 'users.roles', 'billing.write'] },
    popupClicksTodayAsOf: '2026-10-07T18:30:00.000Z', popupClicksTimezone: 'Asia/Ho_Chi_Minh',
  }
}
const detailSection = () => document.querySelector('[aria-label="Click popup hôm nay"]')
const detailCounts = () => [...detailSection().querySelectorAll('.text-2xl')].map(item => item.textContent)
async function testDetail() {
  resetDetailData()
  const Detail = load(path.resolve('app/admin/users/[id]/page.tsx')).default
  await mount(Detail)
  check(() => assert.equal(calls.at(-1).url, '/api/admin/users/user-alpha'))
  check(() => assert.deepEqual(detailCounts(), ['10', '7', '3'], 'Detail shows popup total/Shopee/TikTok separately'))
  check(() => assert.match(detailSection().textContent, /UTC\+7/))
  check(() => assert.match(detailSection().textContent, /01:30:00 8\/10\/2026/, 'Detail snapshot uses the server Vietnam day'))
  check(() => assert.match(document.body.textContent, /14[,.]567 click linkTổng từ trước đến nay/, 'Existing lifetime link count stays clearly separate'))
  check(() => assert.doesNotMatch(detailSection().textContent, /14[,.]567/))

  const selects = document.querySelectorAll('select')
  check(() => assert.equal(selects[2].value, 'support', 'Saved role is initialized once'))
  await input(selects[0], 'ultra')
  await input(selects[1], '1y')
  await input(selects[2], 'viewer')
  await input(document.querySelector('textarea[placeholder="Lý do thay đổi gói"]'), 'Keep this unsaved reason')
  detailData = { ...detailData, user: { ...detailData.user, adminRole: 'ops', popupClicksToday: { shopee: 8, tiktok: 5, total: 13 } }, popupClicksTodayAsOf: '2026-10-07T19:00:00.000Z' }
  const beforeRefresh = calls.length
  await click(button('Cập nhật'))
  check(() => assert.equal(calls.length, beforeRefresh + 1, 'Detail refresh performs one read'))
  check(() => assert.equal(calls.at(-1).cache, 'no-store'))
  check(() => assert.deepEqual(detailCounts(), ['13', '8', '5']))
  check(() => assert.match(detailSection().textContent, /02:00:00 8\/10\/2026/))
  check(() => assert.equal(selects[0].value, 'ultra'))
  check(() => assert.equal(selects[1].value, '1y'))
  check(() => assert.equal(selects[2].value, 'viewer', 'Refresh does not replace unsaved role with the API value'))
  check(() => assert.equal(document.querySelector('textarea[placeholder="Lý do thay đổi gói"]').value, 'Keep this unsaved reason'))

  await click(button('Khóa'))
  const pendingDialog = document.querySelector('.fixed.inset-0')
  check(() => assert.match(pendingDialog.textContent, /Khóa tài khoản/))
  await input(pendingDialog.querySelector('textarea'), 'Keep pending action reason')
  await click(button('Cập nhật'))
  check(() => assert.equal(document.querySelector('.fixed.inset-0'), pendingDialog, 'Read refresh keeps pending action state'))
  check(() => assert.equal(pendingDialog.querySelector('textarea').value, 'Keep pending action reason'))
  check(() => assert.equal(selects[2].value, 'viewer'))
  check(() => assert.equal(calls.filter(call => call.method && call.method !== 'GET').length, 0, 'Refreshing metrics never executes the pending action'))
  await click(button('Hủy'))

  detailError = new Error('Fixture network unavailable')
  await click(button('Cập nhật'))
  check(() => assert.match(document.querySelector('[role="alert"]').textContent, /Fixture network unavailable/))
  check(() => assert.deepEqual(detailCounts(), ['13', '8', '5'], 'Failed refresh retains the labeled previous snapshot instead of inventing zero values'))
  check(() => assert.match(detailSection().textContent, /02:00:00 8\/10\/2026/))
  check(() => assert.equal(selects[2].value, 'viewer'))

  detailError = null
  detailData = { ...detailData, user: { ...detailData.user, popupClicksToday: undefined } }
  await click(button('Cập nhật'))
  check(() => assert.deepEqual(detailCounts(), ['—', '—', '—'], 'Missing data is not a zero-valued result'))
  check(() => assert.match(detailSection().textContent, /Chưa có số liệu/))
  check(() => assert.equal(document.querySelector('[role="alert"]'), null))
  detailData = { ...detailData, user: { ...detailData.user, popupClicksToday: { shopee: 0, tiktok: 0, total: 0 } } }
  await click(button('Cập nhật'))
  check(() => assert.deepEqual(detailCounts(), ['0', '0', '0'], 'A successful zero-filled API result displays zero'))
  check(() => assert.doesNotMatch(detailSection().textContent, /Chưa có số liệu/))

  detailError = 'Forbidden'
  await mount(Detail)
  check(() => assert.match(document.querySelector('[role="alert"]').textContent, /Forbidden/))
  check(() => assert.equal(detailSection(), null, 'Initial access failure exposes no metrics'))
  detailError = null
  await click(button('Thử lại'))
  check(() => assert.deepEqual(detailCounts(), ['0', '0', '0']))
  check(() => assert.equal(calls.filter(call => call.method && call.method !== 'GET').length, 0))
  console.log('PASS admin user detail popup today counts, snapshot timezone, read refresh, unavailable data and preserved action drafts')
}

async function testDetailNavigation() {
  resetDetailData()
  navigationId = 'user-alpha'
  const Detail = load(path.resolve('app/admin/users/[id]/page.tsx')).default
  const navigate = async id => {
    navigationId = id
    await React.act(async () => root.render(React.createElement(Detail, { key: 'detail-navigation' })))
  }
  const snapshot = (id, total) => ({ ...detailData, user: { ...detailData.user, id, name: id, email: id + '@fixture.example', adminRole: 'finance', popupClicksToday: { total, shopee: total - 1, tiktok: 1 } } })
  await navigate('user-alpha')
  await input(document.querySelectorAll('select')[0], 'ultra')
  await input(document.querySelectorAll('select')[2], 'viewer')
  await input(document.querySelector('textarea[placeholder="Lý do thay đổi gói"]'), 'Old user reason')
  await click(button('Khóa'))
  pendingDetailRequests = []
  await click(button('Cập nhật'))
  await navigate('user-beta')
  check(() => assert.equal(pendingDetailRequests[1].url, '/api/admin/users/user-beta'))
  check(() => assert.equal(detailSection(), null, 'ID navigation hides the previous account metrics while loading'))
  check(() => assert.equal(document.querySelector('.fixed.inset-0'), null, 'Old pending actions are hidden on ID change'))
  check(() => assert.equal(button('Khóa'), undefined))
  check(() => assert.doesNotMatch(document.body.textContent, /user-alpha|Old user reason/))
  let finishOldBody
  const delayedBody = new Promise(done => { finishOldBody = done })
  await React.act(async () => pendingDetailRequests[1].resolve({ ok: true, json: () => delayedBody }))
  await navigate('user-gamma')
  check(() => assert.equal(pendingDetailRequests[2].url, '/api/admin/users/user-gamma'))
  check(() => assert.equal(detailSection(), null))
  await React.act(async () => pendingDetailRequests[2].resolve(response(snapshot('user-gamma', 33))))
  check(() => assert.equal(document.querySelector('h1').textContent, 'user-gamma'))
  check(() => assert.deepEqual(detailCounts(), ['33', '32', '1']))
  check(() => assert.equal(document.querySelectorAll('select')[0].value, 'pro', 'New account starts with fresh action fields'))
  check(() => assert.equal(document.querySelectorAll('select')[1].value, '1m'))
  check(() => assert.equal(document.querySelectorAll('select')[2].value, 'finance', 'New account initializes its own saved role'))
  check(() => assert.equal(document.querySelector('textarea[placeholder="Lý do thay đổi gói"]').value, ''))
  await React.act(async () => finishOldBody(snapshot('user-beta', 777)))
  await React.act(async () => pendingDetailRequests[0].resolve(response(snapshot('user-alpha', 999))))
  check(() => assert.equal(document.querySelector('h1').textContent, 'user-gamma'))
  check(() => assert.deepEqual(detailCounts(), ['33', '32', '1'], 'Older parsed body/refresh cannot replace the new account snapshot'))
  check(() => assert.doesNotMatch(document.body.textContent, /Old user reason|777|999/))

  await navigate('user-beta')
  await navigate('user-gamma')
  await React.act(async () => pendingDetailRequests[3].reject(new Error('Old account fetch failed')))
  check(() => assert.equal(detailSection(), null, 'A stale failure cannot end the new account loading state'))
  check(() => assert.doesNotMatch(document.body.textContent, /Old account fetch failed/))
  await React.act(async () => pendingDetailRequests[4].resolve(response(snapshot('user-gamma', 44))))
  check(() => assert.deepEqual(detailCounts(), ['44', '43', '1']))
  check(() => assert.equal(document.querySelector('[role="alert"]'), null))
  await click(button('Cập nhật'))
  await React.act(async () => root.render(null))
  await React.act(async () => pendingDetailRequests[5].resolve(response(snapshot('user-gamma', 888))))
  check(() => assert.equal(document.querySelector('#root').textContent, '', 'Unmount ignores a late detail snapshot'))
  check(() => assert.equal(calls.filter(call => call.method && call.method !== 'GET').length, 0))
  pendingDetailRequests = null
  navigationId = 'user-alpha'
  console.log('PASS admin user detail ID reset, delayed body/refresh, stale errors and unmount guards')
}

async function run() {
  await testList()
  await testListOverlaps()
  await testDetail()
  await testDetailNavigation()
  await React.act(async () => root.unmount())
  console.log('RESULT=PASS admin-popup-clicks-ui-assertions=' + assertions)
}
run().catch(error => { console.error(error); process.exitCode = 1 })
