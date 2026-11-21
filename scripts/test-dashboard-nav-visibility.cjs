/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const React = require('react')
const { createRoot } = require('react-dom/client')

const root = path.resolve(__dirname, '..')
const state = { actor: null, appSettings: new Map() }
const cache = new Map()

const prisma = {
  appSetting: {
    findUnique: async ({ where }) => state.appSettings.get(where.key) || null,
    upsert: async ({ where, create, update }) => {
      const existing = state.appSettings.get(where.key)
      const next = existing
        ? { ...existing, ...update, updatedAt: new Date() }
        : { id: `setting-${where.key}`, ...create, createdAt: new Date(), updatedAt: new Date() }
      state.appSettings.set(where.key, next)
      return next
    },
  },
}

const iconStub = () => React.createElement('span')
const icons = new Proxy({}, { get: () => iconStub })

function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const localRequire = id => {
    if (id === '@/lib/prisma') return { prisma }
    if (id === '@/lib/content-management') return { getManagedContentActor: async () => state.actor }
    if (id === '@/lib/dashboard-nav-visibility') return load('lib/dashboard-nav-visibility.ts')
    if (id === '@/lib/dashboard-nav-visibility-server') return load('lib/dashboard-nav-visibility-server.ts')
    if (id === '@/lib/fetch') return { apiFetch: () => Promise.resolve({ json: async () => [] }) }
    if (id === '@/components/CreateLinkModal') return () => null
    if (id === 'lucide-react') return icons
    if (id === 'next/link') return ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children)
    if (id === 'next/image') return ({ alt }) => React.createElement('img', { alt })
    if (id === 'next/navigation') return { usePathname: () => '/dashboard/settings' }
    if (id === 'next-auth/react') return { signOut: () => {} }
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const navApi = load('app/api/settings/navigation/route.ts')
const DashboardNavLinks = load('app/dashboard/DashboardNavLinks.tsx').default
const MobileNav = load('app/dashboard/MobileNav.tsx').default
const CreateLinkButton = load('app/dashboard/CreateLinkButton.tsx').default
const MenuVisibilitySection = load('app/dashboard/settings/MenuVisibilitySection.tsx').default

global.IS_REACT_ACT_ENVIRONMENT = true

async function run() {
  let scenarios = 0

  // 1. API auth & tenant isolation
  assert.equal((await navApi.GET()).status, 401)
  assert.equal((await navApi.PUT({ json: async () => ({ links: false }) })).status, 401)

  state.actor = { id: 'user-a', email: 'a@example.test', isAdmin: false }
  const initialA = await (await navApi.GET()).json()
  assert.deepEqual(initialA.visibility, { links: true, folders: true, analytics: true, notes: true, fbDebug: true, tiktokAff: true })

  assert.equal((await navApi.PUT({ json: async () => ({ unknownKey: false }) })).status, 400)

  const updatedA = await (await navApi.PUT({ json: async () => ({ notes: false, fbDebug: false, tiktokAff: false }) })).json()
  assert.deepEqual(updatedA.visibility, { links: true, folders: true, analytics: true, notes: false, fbDebug: false, tiktokAff: false })

  state.actor = { id: 'user-b', email: 'b@example.test', isAdmin: false }
  const initialB = await (await navApi.GET()).json()
  assert.deepEqual(initialB.visibility, { links: true, folders: true, analytics: true, notes: true, fbDebug: true, tiktokAff: true }, 'Other users keep independent menu settings')
  scenarios += 1

  // 2. Live synchronization across Desktop sidebar, Mobile drawer/bottom bar, CreateLinkButton, and Settings UI
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://rutgonlink.site/dashboard/settings' })
  global.window = dom.window
  global.document = dom.window.document
  global.CustomEvent = dom.window.CustomEvent
  global.Event = dom.window.Event

  let failNextSave = false
  global.fetch = async (url, init = {}) => {
    assert.equal(url, '/api/settings/navigation')
    if (failNextSave) {
      return { ok: false, status: 500, json: async () => ({ error: 'Simulated failure' }) }
    }
    const res = await navApi.PUT({ json: async () => JSON.parse(init.body) })
    return { ok: res.status === 200, status: res.status, json: () => res.json() }
  }

  state.actor = { id: 'user-ui', email: 'ui@example.test', isAdmin: true }
  const uiRoot = createRoot(document.getElementById('app'))
  await React.act(async () => {
    uiRoot.render(
      React.createElement(
        'div',
        null,
        React.createElement('div', { id: 'desktop-nav' }, React.createElement(DashboardNavLinks, { isAdmin: true })),
        React.createElement('div', { id: 'mobile-nav' }, React.createElement(MobileNav, { userName: 'Admin', userEmail: 'ui@example.test', userInitial: 'A', isAdmin: true })),
        React.createElement('div', { id: 'header-cta' }, React.createElement(CreateLinkButton, {})),
        React.createElement('div', { id: 'settings-card' }, React.createElement(MenuVisibilitySection, {})),
      ),
    )
  })

  const desktopLabels = () => [...document.querySelectorAll('#desktop-nav a')].map(a => a.textContent.trim())
  const headerHasCreateLink = () => document.querySelector('#header-cta')?.textContent.includes('Tạo link mới')
  const clickButton = async btn => { assert.ok(btn); await React.act(async () => { btn.click() }) }

  assert.deepEqual(desktopLabels(), ['Tổng quan', 'Links', 'Folders', 'Thống kê', 'Ghi chú', 'FB Debug', 'TikTok AFF', 'Popups', 'Bài viết', 'Ghép ảnh', 'Cài đặt', 'Admin'])
  assert.equal(headerHasCreateLink(), true)

  // Toggle Links OFF -> hides Links and CreateLinkButton immediately
  await clickButton(document.querySelector('button[aria-label="Hiển thị Links"]'))
  assert.equal(desktopLabels().includes('Links'), false)
  assert.equal(headerHasCreateLink(), false)
  scenarios += 1

  // Toggle TikTok AFF OFF -> hides TikTok AFF immediately
  await clickButton(document.querySelector('button[aria-label="Hiển thị TikTok AFF"]'))
  assert.equal(desktopLabels().includes('TikTok AFF'), false)
  scenarios += 1

  // Click "Ẩn gọn cả 6 mục" -> hides all 6 optional modules while keeping core items
  const hideAllBtn = [...document.querySelectorAll('#settings-card button')].find(b => b.textContent.trim() === 'Ẩn gọn cả 6 mục')
  await clickButton(hideAllBtn)
  assert.deepEqual(desktopLabels(), ['Tổng quan', 'Popups', 'Bài viết', 'Ghép ảnh', 'Cài đặt', 'Admin'])
  const mobileBottomLabels = [...document.querySelectorAll('#mobile-nav nav')][1].querySelectorAll('a')
  assert.deepEqual([...mobileBottomLabels].map(a => a.textContent.trim()), ['Tổng quan', 'Bài viết', 'Popups', 'Ghép ảnh', 'Cài đặt', 'Admin'])
  scenarios += 1

  // Network failure rolls back optimistic change
  failNextSave = true
  await clickButton(document.querySelector('button[aria-label="Hiển thị Ghi chú"]'))
  assert.equal(desktopLabels().includes('Ghi chú'), false, 'Rollback hides Ghi chú after failed save')
  failNextSave = false
  scenarios += 1

  // Click "Hiện tất cả" -> restores all 5 modules and CreateLinkButton
  const showAllBtn = [...document.querySelectorAll('#settings-card button')].find(b => b.textContent.trim() === 'Hiện tất cả')
  await clickButton(showAllBtn)
  assert.equal(desktopLabels().length, 12)
  assert.equal(headerHasCreateLink(), true)
  scenarios += 1

  await React.act(async () => uiRoot.unmount())
  dom.window.close()
  console.log(`RESULT=PASS dashboard-nav-visibility=${scenarios}`)
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
