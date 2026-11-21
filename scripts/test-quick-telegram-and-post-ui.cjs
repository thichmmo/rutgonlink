/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://rutgonlink.site/dashboard',
  pretendToBeVisual: true,
})
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.HTMLElement = dom.window.HTMLElement
global.HTMLInputElement = dom.window.HTMLInputElement
global.Event = dom.window.Event
global.CustomEvent = dom.window.CustomEvent
global.IS_REACT_ACT_ENVIRONMENT = true

const React = require('react')
const { createRoot } = require('react-dom/client')

const root = path.resolve(__dirname, '..')
const cache = new Map()

const state = {
  actor: null,
  appSettings: new Map(),
  users: new Map(),
  popups: [],
  posts: [],
}

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
  user: {
    findUnique: async ({ where }) => state.users.get(where.id) || null,
  },
  managedPost: {
    findFirst: async ({ where }) => {
      const list = state.posts
        .filter((post) => {
          if (post.userId !== where.userId) return false
          if (where.popupId?.not === null && !post.popupId) return false
          const popup = state.popups.find((p) => p.id === post.popupId)
          if (where.popup?.isActive === true && (!popup || !popup.isActive)) return false
          return true
        })
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      if (!list[0]) return null
      const popup = state.popups.find((p) => p.id === list[0].popupId)
      return { popup: { id: popup.id, name: popup.name } }
    },
  },
  popupTemplate: {
    findFirst: async ({ where }) => {
      const list = state.popups
        .filter((p) => p.userId === where.userId && p.isActive === where.isActive)
        .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      return list[0] ? { id: list[0].id, name: list[0].name } : null
    },
  },
}

const iconStub = () => React.createElement('span')
const icons = new Proxy({}, { get: () => iconStub })

function load(file) {
  const fullPath = path.isAbsolute(file) ? file : path.join(root, file)
  const resolved = path.extname(fullPath)
    ? fullPath
    : fs.existsSync(`${fullPath}.tsx`)
      ? `${fullPath}.tsx`
      : `${fullPath}.ts`
  if (cache.has(resolved)) return cache.get(resolved).exports
  const module = { exports: {} }
  cache.set(resolved, module)
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    fileName: resolved,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText

  const localRequire = (id) => {
    if (id === '@/lib/prisma') return { prisma }
    if (id === '@/lib/content-management') {
      return {
        getManagedContentActor: async () => state.actor,
        getPublicationTargets: async () => [
          { id: null, domain: 'rutgonlink.site', kind: 'primary' },
          { id: null, domain: 'ca33newss.xyz', kind: 'shared' },
        ],
      }
    }
    if (id === '@/lib/post-default-domain-config') {
      return {
        getSystemDefaultPostDomain: async () => ({
          defaultDomain: 'ca33newss.xyz',
          updatedAt: null,
          updatedBy: null,
        }),
      }
    }
    if (id === '@/lib/site-config') return { getSiteHostname: () => 'rutgonlink.site' }
    if (id === '@/lib/fetch') return { apiFetch: (url, init) => global.fetch(url, init) }
    if (id === 'lucide-react') return icons
    if (id === 'next/link') {
      return ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children)
    }
    if (id === 'next/image') {
      return ({ src, alt }) => React.createElement('img', { src, alt })
    }
    if (id.startsWith('@/')) return load(id.slice(2))
    if (id.startsWith('.')) return load(path.join(path.dirname(resolved), id))
    return require(id)
  }

  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const quickModeApi = load('app/api/settings/quick-mode/route.ts')
const quickServer = load('lib/dashboard-quick-mode-server.ts')
const QuickCreateModeSection = load('app/dashboard/settings/QuickCreateModeSection.tsx').default
const DashboardQuickShorten = load('app/dashboard/DashboardQuickShorten.tsx').default
const PopupAnalytics = load('app/dashboard/PopupAnalytics.tsx').default
const TelegramSettingsFields = load('app/dashboard/settings/TelegramSettingsFields.tsx').default

async function run() {
  let scenarios = 0

  // 1. /api/settings/quick-mode auth, tenant isolation, and most-recently-used popup lookup
  assert.equal((await quickModeApi.GET()).status, 401)
  assert.equal((await quickModeApi.PUT({ json: async () => ({ mode: 'telegram-post' }) })).status, 401)

  state.actor = { id: 'user-1', email: 'u1@example.test', isAdmin: false }
  state.users.set('user-1', {
    telegramSettings: {
      enabled: true,
      url: 'https://t.me/honghotduongpho2027',
      buttonText: '✈️ VÀO NHÓM TELEGRAM NGAY',
      disclaimer: 'Miễn trừ trách nhiệm',
    },
  })
  state.popups = [
    { id: 'pop-1', userId: 'user-1', name: 'Popup Cũ', isActive: true, createdAt: 100, updatedAt: 100 },
    { id: 'pop-2', userId: 'user-1', name: 'Popup 2', isActive: true, createdAt: 200, updatedAt: 200 },
    { id: 'pop-3', userId: 'user-1', name: 'Popup Mới Chưa Dùng', isActive: true, createdAt: 300, updatedAt: 300 },
    { id: 'pop-off', userId: 'user-1', name: 'Popup Đã Tắt', isActive: false, createdAt: 400, updatedAt: 400 },
  ]
  // Fallback when user has no posts yet -> newest active popup (pop-3)
  assert.deepEqual(await quickServer.getMostRecentlyUsedActivePopup('user-1'), {
    id: 'pop-3',
    name: 'Popup Mới Chưa Dùng',
  })

  // When user's latest post used pop-2 (and an even newer post used deactivated pop-off), pop-2 wins!
  state.posts = [
    { id: 'post-1', userId: 'user-1', popupId: 'pop-2', createdAt: 500 },
    { id: 'post-2', userId: 'user-1', popupId: 'pop-off', createdAt: 600 },
  ]
  assert.deepEqual(await quickServer.getMostRecentlyUsedActivePopup('user-1'), {
    id: 'pop-2',
    name: 'Popup 2',
  })

  const initialGet = await (await quickModeApi.GET()).json()
  assert.equal(initialGet.mode, 'shorten')
  assert.equal(initialGet.telegramConfig.latestPopup.id, 'pop-2')
  assert.equal(initialGet.telegramConfig.domainName, 'ca33newss.xyz')

  assert.equal((await quickModeApi.PUT({ json: async () => ({ mode: 'invalid' }) })).status, 400)
  const savedMode = await (
    await quickModeApi.PUT({ json: async () => ({ mode: 'telegram-post' }) })
  ).json()
  assert.equal(savedMode.mode, 'telegram-post')

  state.actor = { id: 'user-2', email: 'u2@example.test', isAdmin: false }
  assert.equal((await (await quickModeApi.GET()).json()).mode, 'shorten')
  state.actor = { id: 'user-1', email: 'u1@example.test', isAdmin: false }
  scenarios += 1

  // 2. DOM environment for Settings, Quick Telegram Box, PopupAnalytics, and Multi-link Telegram fields
  const copied = []
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText: async (txt) => copied.push(txt) },
    configurable: true,
  })

  let statsRefreshEvents = 0
  dom.window.addEventListener('popup-stats-refresh', () => {
    statsRefreshEvents += 1
  })

  const postCalls = []
  const analyticsPayload = {
    generatedAt: '2026-11-21T02:05:00.000Z',
    totals: {
      hour: { shopee: 0, tiktok: 0, total: 0 },
      today: { shopee: 2, tiktok: 1, total: 3 },
      yesterday: { shopee: 0, tiktok: 0, total: 0 },
      dayBefore: { shopee: 1, tiktok: 1, total: 2 },
    },
    posts: {
      total: 2,
      page: 1,
      pageSize: 10,
      items: [
        {
          id: 'p-37325',
          title: 'Video Telegram - bản sao',
          slug: 'p7-37325',
          image: null,
          createdAt: '2026-11-21T02:05:00.000Z', // 09:05 21/11/2026 in UTC+7
          popupName: '2',
          publicUrl: 'https://ca33newss.xyz/p7/37325',
          stats: {
            hour: { shopee: 0, tiktok: 0, total: 0 },
            today: { shopee: 2, tiktok: 1, total: 3 },
            yesterday: { shopee: 0, tiktok: 0, total: 0 },
            dayBefore: { shopee: 0, tiktok: 0, total: 0 },
          },
        },
        {
          id: 'p-custom',
          title: 'cân nhắc khi xem',
          slug: 'can-nhac-khi-xem',
          image: null,
          createdAt: '2026-11-20T16:30:00.000Z', // 23:30 20/11/2026 in UTC+7
          popupName: '2',
          publicUrl: 'https://ca33newss.xyz/can-nhac-khi-xem',
          stats: {
            hour: { shopee: 0, tiktok: 0, total: 0 },
            today: { shopee: 0, tiktok: 0, total: 0 },
            yesterday: { shopee: 0, tiktok: 0, total: 0 },
            dayBefore: { shopee: 1, tiktok: 1, total: 2 },
          },
        },
      ],
    },
    popups: { total: 0, page: 1, pageSize: 10, items: [] },
  }

  global.fetch = async (url, init = {}) => {
    if (url === '/api/settings/quick-mode' && init.method === 'PUT') {
      const res = await quickModeApi.PUT({ json: async () => JSON.parse(init.body) })
      return { ok: res.status === 200, status: res.status, json: () => res.json() }
    }
    if (url === '/api/posts' && init.method === 'POST') {
      const body = JSON.parse(init.body)
      postCalls.push(body)
      return {
        ok: true,
        status: 201,
        json: async () => ({
          items: [
            {
              id: 'created-58888',
              title: '58888',
              slug: 'p7-58888',
              publicUrl: 'https://ca33newss.xyz/p7/58888',
            },
          ],
          created: 1,
        }),
      }
    }
    if (String(url).startsWith('/api/popup-stats?')) {
      return { ok: true, status: 200, json: async () => analyticsPayload }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }

  const inputValue = async (el, val) => {
    const proto = dom.window.HTMLInputElement.prototype
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val)
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }
  const click = async (el) => {
    assert.ok(el, 'Expected clickable element')
    await React.act(async () => {
      el.click()
    })
  }

  const uiRoot = createRoot(document.getElementById('app'))

  // 2a. QuickCreateModeSection switches to telegram-post
  await React.act(async () => {
    uiRoot.render(React.createElement(QuickCreateModeSection, { initialMode: 'shorten' }))
  })
  const tgRadio = [...document.querySelectorAll('button[role="radio"]')].find((b) =>
    b.textContent.includes('Tạo nhanh bài Telegram'),
  )
  await click(tgRadio)
  assert.equal(tgRadio.getAttribute('aria-checked'), 'true')
  scenarios += 1

  // 2b. DashboardQuickShorten in mode="telegram-post" creates published post with latest popup & copies protocol-free link
  const tgConfig = (await (await quickModeApi.GET()).json()).telegramConfig
  await React.act(async () => {
    uiRoot.render(
      React.createElement(DashboardQuickShorten, {
        mode: 'telegram-post',
        telegramConfig: tgConfig,
      }),
    )
  })
  assert.match(document.body.textContent, /Tạo nhanh bài Telegram/)
  assert.match(document.body.textContent, /Popup gần nhất:\s*Popup 2/)
  assert.match(document.body.textContent, /Domain:\s*ca33newss\.xyz/)

  const videoInput = document.querySelector('input[aria-label="Tạo nhanh bằng URL video hoặc mã iframe"]')
  await inputValue(videoInput, 'https://cdn.example.com/clip-hot.mp4')
  await React.act(async () => {
    videoInput.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  })

  assert.equal(postCalls.length, 1)
  assert.equal(postCalls[0].publicLinkMode, 'numeric')
  assert.equal(postCalls[0].isPublished, true)
  assert.deepEqual(postCalls[0].popupIds, ['pop-2'])
  assert.equal(postCalls[0].sharedDomain, 'ca33newss.xyz')
  assert.equal(postCalls[0].telegramSettings.enabled, true)
  assert.match(postCalls[0].content, /<video\b[^>]*src="https:\/\/cdn\.example\.com\/clip-hot\.mp4"/)
  assert.equal(statsRefreshEvents, 1)

  // Result displays protocol-free URL & code title, and Copy link strips https://
  assert.match(document.body.textContent, /Mã bài #58888/)
  assert.match(document.body.textContent, /ca33newss\.xyz\/p7\/58888/)
  assert.doesNotMatch(document.body.textContent, /https:\/\/ca33newss\.xyz\/p7\/58888/)
  const quickCopyBtn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Copy link'),
  )
  await click(quickCopyBtn)
  assert.equal(copied.at(-1), 'ca33newss.xyz/p7/58888')
  scenarios += 1

  // 2c. PopupAnalytics renders 5-digit code title, Vietnam createdAt time, and protocol-free Copy link button
  await React.act(async () => {
    uiRoot.render(React.createElement(PopupAnalytics, {}))
  })
  await new Promise((r) => setTimeout(r, 220))
  await React.act(async () => {})

  const row37325 = document.querySelector('[data-testid="stats-post-p-37325"]')
  assert.ok(row37325)
  assert.equal(row37325.querySelector('p.font-semibold').textContent, '37325')
  assert.doesNotMatch(row37325.textContent, /Video Telegram/)
  assert.match(row37325.textContent, /Tạo lúc: 09:05 21\/11\/2026/)
  const rowCopyBtn = row37325.querySelector('button[data-copy-post-link="p-37325"]')
  await click(rowCopyBtn)
  assert.equal(copied.at(-1), 'ca33newss.xyz/p7/37325')
  assert.match(rowCopyBtn.textContent, /Đã copy/)

  const rowCustom = document.querySelector('[data-testid="stats-post-p-custom"]')
  assert.equal(rowCustom.querySelector('p.font-semibold').textContent, 'cân nhắc khi xem')
  assert.match(rowCustom.textContent, /Tạo lúc: 23:30 20\/11\/2026/)
  scenarios += 1

  // 2d. TelegramSettingsFields preset "+ Nút tải App Mê Sale" and "+ Thêm link"
  let tgDraft = {
    enabled: true,
    url: 'https://t.me/honghotduongpho2027',
    buttonText: '✈️ VÀO NHÓM TELEGRAM NGAY',
    disclaimer: '',
  }
  function Harness() {
    const [val, setVal] = React.useState(tgDraft)
    tgDraft = val
    return React.createElement(TelegramSettingsFields, {
      value: val,
      onChange: setVal,
      accountDefaults: true,
    })
  }
  await React.act(async () => {
    uiRoot.render(React.createElement(Harness))
  })
  const mesaleBtn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Nút tải App Mê Sale'),
  )
  await click(mesaleBtn)
  assert.equal(tgDraft.extraButtons.length, 1)
  assert.equal(tgDraft.extraButtons[0].url, 'https://mesale.vn')
  assert.equal(tgDraft.extraButtons[0].color, 'orange')

  const addLinkBtn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Thêm link'),
  )
  await click(addLinkBtn)
  assert.equal(tgDraft.extraButtons.length, 2)

  const deleteFirstBtn = document.querySelector('button[aria-label="Xóa nút phụ 1"]')
  await click(deleteFirstBtn)
  assert.equal(tgDraft.extraButtons.length, 1)
  scenarios += 1

  await React.act(async () => uiRoot.unmount())
  dom.window.close()
  console.log(`RESULT=PASS quick-telegram-and-post-ui=${scenarios}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    dom.window.close()
  })
