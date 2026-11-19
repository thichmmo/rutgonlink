/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const sharp = require('sharp')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const root = path.resolve(__dirname, '..')
const tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rutgonlink-collage-test-'))
process.env.CONTENT_UPLOAD_DIR = tempUploadDir
process.env.ADMIN_EMAIL = 'owner@fixture.example'

// Set up JSDOM for React component assertions in the same suite.
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'https://fixture.example/dashboard/collage',
  pretendToBeVisual: true,
})
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true

const React = require('react')
const { createRoot } = require('react-dom/client')

function transpileTsModule(relFile, customResolve) {
  const fullPath = path.resolve(root, relFile)
  const source = fs.readFileSync(fullPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(
    (id) => customResolve(id, path.dirname(fullPath)),
    mod,
    mod.exports,
  )
  return mod.exports
}

const appSettingsMap = new Map()
const usersMap = new Map()
const auditLogs = []

const prismaMock = {
  appSetting: {
    findUnique: async ({ where: { key } }) => {
      const value = appSettingsMap.get(key)
      return value !== undefined ? { key, value } : null
    },
    upsert: async ({ where: { key }, create, update }) => {
      const nextValue = appSettingsMap.has(key) ? update.value : create.value
      appSettingsMap.set(key, nextValue)
      return { key, value: nextValue }
    },
  },
  user: {
    findUnique: async ({ where: { id } }) => usersMap.get(id) || null,
    update: async ({ where: { id }, data }) => {
      const next = { ...(usersMap.get(id) || {}), ...data }
      usersMap.set(id, next)
      return next
    },
  },
}

let activeActor = null
const activeAdminAccess = {
  ok: true,
  admin: { id: 'admin-owner', email: 'owner@fixture.example', role: 'owner', permissions: ['users.read', 'users.write'] },
}

const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })

const nextServerMock = { NextResponse: { json: jsonResponse } }

const moduleCache = new Map()
function loadBackend(relFile) {
  const normalized = relFile.endsWith('.ts') || relFile.endsWith('.tsx')
    ? relFile
    : fs.existsSync(path.resolve(root, `${relFile}.ts`))
      ? `${relFile}.ts`
      : `${relFile}.tsx`
  if (moduleCache.has(normalized)) return moduleCache.get(normalized)

  const exportsObj = transpileTsModule(normalized, (id, dir) => {
    if (id === 'next/server') return nextServerMock
    if (id === 'next/link') return (props) => React.createElement('a', props, props.children)
    if (id === '@/lib/prisma') return { prisma: prismaMock }
    if (id === '@/lib/content-management') {
      return { getManagedContentActor: async () => activeActor }
    }
    if (id === '@/lib/admin-auth') {
      return {
        ADMIN_ROLES: ['owner', 'support', 'finance', 'ops', 'viewer'],
        requireAdmin: async () => activeAdminAccess,
        hasAdminPermission: (admin, perm) => admin.permissions.includes(perm),
      }
    }
    if (id === '@/lib/admin-audit') {
      return {
        recordAdminAudit: async (entry) => {
          auditLogs.push(entry)
        },
      }
    }
    if (id === '@/lib/admin-popup-clicks') {
      return {
        ADMIN_POPUP_CLICKS_TIMEZONE: 'Asia/Ho_Chi_Minh',
        getAdminUserPopupClicksToday: async (ids) =>
          Object.fromEntries(ids.map((uid) => [uid, { shopee: 0, tiktok: 0, total: 0 }])),
      }
    }
    if (id === '@/lib/billing') {
      return { computePlanEndDate: () => new Date() }
    }
    if (id.startsWith('@/')) {
      return loadBackend(id.slice(2))
    }
    if (id.startsWith('.')) {
      return loadBackend(path.relative(root, path.resolve(dir, id)))
    }
    return require(id)
  })

  moduleCache.set(normalized, exportsObj)
  return exportsObj
}

const collageConfig = loadBackend('lib/reaction-collage-config.ts')
const collageServer = loadBackend('lib/reaction-collage-server.ts')
const collageApi = loadBackend('app/api/collage/route.ts')
const collageSettingsApi = loadBackend('app/api/settings/collage/route.ts')
const adminUserDetailApi = loadBackend('app/api/admin/users/[id]/route.ts')
const ReactionCollageStudio = loadBackend('app/dashboard/collage/ReactionCollageStudio.tsx').default

async function makeSampleSourceImage({
  width = 1080,
  height = 1920,
  withExif = true,
  background = { r: 34, g: 130, b: 210 },
} = {}) {
  let img = sharp({
    create: { width, height, channels: 3, background },
  })
  if (withExif) {
    img = img.withMetadata({
      exif: {
        IFD0: { Software: 'Android Screenshot Tool', Make: 'TestScreenshotDevice' },
      },
    })
  }
  return img.jpeg({ quality: 90 }).toBuffer()
}

async function makeTransparentCutoutPng(width = 300, height = 360) {
  // Draw an opaque triangle/person silhouette centered-bottom with fully transparent top corners.
  const buf = Buffer.alloc(width * height * 4, 0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inUpperBg = y < Math.round(height * 0.45) && (x < 60 || x > width - 60)
      if (!inUpperBg && y > 10) {
        const idx = (y * width + x) * 4
        buf[idx] = 220
        buf[idx + 1] = 80
        buf[idx + 2] = 120
        buf[idx + 3] = 255
      }
    }
  }
  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

function makeMultipartRequest(urlStr, fields) {
  const form = new FormData()
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) form.append(key, val)
  }
  return {
    nextUrl: new URL(urlStr),
    formData: async () => form,
  }
}

function makeJsonRequest(urlStr, body) {
  return {
    nextUrl: new URL(urlStr),
    headers: new Headers(),
    json: async () => body,
  }
}

const scenarios = []
function scenario(name, fn) {
  scenarios.push({ name, fn })
}

scenario('default transparent cutout PNG exists with RGBA alpha, transparent upper corners, and flush opaque bottom pixels', async () => {
  const defaultPath = path.join(root, 'public', 'defaults', 'reaction-default.png')
  assert.equal(fs.existsSync(defaultPath), true, 'public/defaults/reaction-default.png must exist')
  const { data, info } = await sharp(defaultPath).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.channels, 4, 'default template must carry RGBA alpha channel')
  assert.ok(info.width >= 400 && info.height >= 400)

  // Top-left & top-right corners must be transparent (no rectangular box background).
  assert.equal(data[3], 0, 'top-left pixel must be transparent')
  assert.equal(data[(info.width - 1) * 4 + 3], 0, 'top-right pixel must be transparent')

  // Bottom center torso pixel must be opaque and flush with the bottom edge.
  const bottomMidIdx = ((info.height - 1) * info.width + Math.floor(info.width / 2)) * 4
  assert.ok(data[bottomMidIdx + 3] > 200, 'bottom torso pixel must sit flush along the bottom edge')
})

scenario('unauthenticated requests to collage & settings endpoints return 401', async () => {
  activeActor = null
  assert.equal((await collageApi.GET()).status, 401)
  assert.equal((await collageApi.POST(makeMultipartRequest('https://fixture.example/api/collage', {}))).status, 401)
  assert.equal((await collageApi.DELETE({ nextUrl: new URL('https://fixture.example/api/collage?all=1') })).status, 401)
  assert.equal((await collageSettingsApi.GET()).status, 401)
  assert.equal((await collageSettingsApi.PUT(makeJsonRequest('https://fixture.example/api/settings/collage', {}))).status, 401)
  assert.equal((await collageSettingsApi.POST(makeMultipartRequest('https://fixture.example/api/settings/collage', {}))).status, 401)
})

scenario('flush bottom corner cutout compositing keeps transparent upper pixels white without rectangular frame/border', async () => {
  const whiteCanvas = await makeSampleSourceImage({
    width: 1000,
    height: 1000,
    withExif: false,
    background: { r: 255, g: 255, b: 255 },
  })
  const baseSettings = collageConfig.defaultUserCollageSettings()

  const leftOut = await collageServer.composeReactionCollageBuffer(whiteCanvas, baseSettings, false, {
    corner: 'bottom-left',
    scalePercent: 38,
  })
  const { data: leftPixels, info: leftInfo } = await sharp(leftOut.buffer).raw().toBuffer({ resolveWithObject: true })
  // Bottom-left interior (x=150, y=H-4) must be colored by the flush bottom woman cutout (not pure white).
  const blIdx = ((leftInfo.height - 4) * leftInfo.width + 150) * 3
  assert.ok(leftPixels[blIdx] < 240 || leftPixels[blIdx + 1] < 240, 'bottom-left cutout touches bottom flush area')
  // Bottom-right corner (x=W-10, y=H-4) remains near-white when placed on bottom-left.
  const brClearIdx = ((leftInfo.height - 4) * leftInfo.width + (leftInfo.width - 10)) * 3
  assert.ok(leftPixels[brClearIdx] >= 250 && leftPixels[brClearIdx + 1] >= 250 && leftPixels[brClearIdx + 2] >= 250)
  // Upper-left of overlay bounding box (x=4, top-of-cutout area) stays white due to transparent cutout.
  const topLeftBoxIdx = ((leftInfo.height - 380) * leftInfo.width + 4) * 3
  assert.ok(leftPixels[topLeftBoxIdx] >= 250 && leftPixels[topLeftBoxIdx + 1] >= 250 && leftPixels[topLeftBoxIdx + 2] >= 250)

  const rightOut = await collageServer.composeReactionCollageBuffer(whiteCanvas, baseSettings, false, {
    corner: 'bottom-right',
    scalePercent: 38,
  })
  const { data: rightPixels, info: rightInfo } = await sharp(rightOut.buffer).raw().toBuffer({ resolveWithObject: true })
  const brIdx = ((rightInfo.height - 4) * rightInfo.width + (rightInfo.width - 150)) * 3
  assert.ok(rightPixels[brIdx] < 240 || rightPixels[brIdx + 1] < 240, 'bottom-right cutout touches bottom-right corner')
})

scenario('FB optimization stays 100% silent in user JSON APIs while Admin toggle activates ~2048px, stripped EXIF, distinct hashes, and IMG_ filenames', async () => {
  activeActor = { id: 'user-standard', email: 'member@fixture.example', isAdmin: false }
  usersMap.set('user-standard', {
    id: 'user-standard',
    numericId: 201,
    email: 'member@fixture.example',
    name: 'Standard Member',
    loginType: 'password',
    status: 'active',
    adminRole: null,
    plan: 'free',
    planExpiresAt: null,
    suspendedAt: null,
    suspensionReason: null,
    deletedAt: null,
    sessionsRevokedAt: null,
  })

  // Confirm user GET settings/collage responses do NOT leak FB permission flags.
  const settingsData = await (await collageSettingsApi.GET()).json()
  assert.equal('canUseFbViral' in settingsData, false)
  assert.equal('fbViralEnabled' in settingsData.settings, false)
  assert.equal(settingsData.settings.templateImageUrl, '/defaults/reaction-default.png')

  const srcBytes = await makeSampleSourceImage({ width: 1440, height: 2560, withExif: true })
  const stdRes = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: new File([srcBytes], 'screenshot.jpg', { type: 'image/jpeg' }),
      corner: 'bottom-left',
    }),
  )
  assert.equal(stdRes.status, 201)
  const stdData = await stdRes.json()
  assert.equal('canUseFbViral' in stdData, false)
  assert.equal('fbOptimized' in stdData.item, false)
  assert.match(stdData.item.downloadName, /^ghep-anh-\d{8}_\d{6}\.jpg$/)
  assert.ok(Math.max(stdData.item.width, stdData.item.height) <= 1280)

  // Admin grants FB optimization in backend.
  const patchGrant = await adminUserDetailApi.PATCH(
    makeJsonRequest('https://fixture.example/api/admin/users/user-standard', {
      action: 'set-fb-viral-collage',
      fbViralCollageEnabled: true,
      reason: 'Bật tối ưu ảnh đề xuất FB ở backend',
    }),
    { params: Promise.resolve({ id: 'user-standard' }) },
  )
  assert.equal(patchGrant.status, 200)
  assert.equal(auditLogs.at(-1)?.action, 'user.set-fb-viral-collage')

  // User posts two identical screenshots -> backend silently outputs ~2048px HD preserving 9:16 ratio, stripped EXIF, IMG_ filename, and unique hashes.
  const res1 = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: new File([srcBytes], 'paste-1.jpg', { type: 'image/jpeg' }),
      corner: 'bottom-right',
    }),
  )
  const data1 = await res1.json()
  assert.equal('canUseFbViral' in data1, false)
  assert.equal('fbOptimized' in data1.item, false)
  assert.match(data1.item.downloadName, /^IMG_\d{8}_\d{6}_\d{3}\.jpg$/)
  assert.ok(data1.item.height >= 2042 && data1.item.height <= 2048)
  assert.equal(data1.item.width, Math.round((1440 * data1.item.height) / 2560))

  const outBuf1 = fs.readFileSync(path.join(tempUploadDir, data1.item.filename))
  const outMeta1 = await sharp(outBuf1).metadata()
  assert.equal(outMeta1.exif, undefined, 'EXIF metadata must be stripped')

  const res2 = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: new File([srcBytes], 'paste-2.jpg', { type: 'image/jpeg' }),
      corner: 'bottom-right',
    }),
  )
  const data2 = await res2.json()
  const outBuf2 = fs.readFileSync(path.join(tempUploadDir, data2.item.filename))
  const sha1 = crypto.createHash('sha256').update(outBuf1).digest('hex')
  const sha2 = crypto.createHash('sha256').update(outBuf2).digest('hex')
  assert.notEqual(sha1, sha2, 'two FB-optimized exports must have distinct cryptographic hashes')

  // Admin revokes -> immediately drops back to <=1280px standard output.
  await adminUserDetailApi.PATCH(
    makeJsonRequest('https://fixture.example/api/admin/users/user-standard', {
      action: 'set-fb-viral-collage',
      fbViralCollageEnabled: false,
      reason: 'Thu hồi quyền tối ưu ảnh đề xuất FB',
    }),
    { params: Promise.resolve({ id: 'user-standard' }) },
  )
  const resAfterRevoke = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: new File([srcBytes], 'paste-3.jpg', { type: 'image/jpeg' }),
      corner: 'bottom-left',
    }),
  )
  const dataAfterRevoke = await resAfterRevoke.json()
  assert.ok(Math.max(dataAfterRevoke.item.width, dataAfterRevoke.item.height) <= 1280)
  assert.match(dataAfterRevoke.item.downloadName, /^ghep-anh-\d{8}_\d{6}\.jpg$/)
})

scenario('history strictly keeps 10 most recent images per user and unlinks evicted files on disk', async () => {
  activeActor = { id: 'user-prune', email: 'prune@fixture.example', isAdmin: true }
  const srcBytes = await makeSampleSourceImage({ width: 800, height: 1000, withExif: false })
  const createdFilenames = []

  for (let i = 0; i < 12; i++) {
    const res = await collageApi.POST(
      makeMultipartRequest('https://fixture.example/api/collage', {
        file: new File([srcBytes], `batch-${i}.jpg`, { type: 'image/jpeg' }),
        corner: 'bottom-left',
      }),
    )
    assert.equal(res.status, 201)
    const body = await res.json()
    createdFilenames.push(body.item.filename)
    assert.ok(body.items.length <= collageConfig.MAX_COLLAGE_HISTORY)
  }

  const historyData = await (await collageApi.GET()).json()
  assert.equal(historyData.items.length, 10)
  assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[0])), false, '1st oldest unlinked')
  assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[1])), false, '2nd oldest unlinked')
  for (let i = 2; i < 12; i++) {
    assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[i])), true, `recent ${i} retained`)
  }

  const targetToDelete = historyData.items[0]
  const delSingleRes = await collageApi.DELETE({
    nextUrl: new URL(`https://fixture.example/api/collage?id=${encodeURIComponent(targetToDelete.id)}`),
  })
  assert.equal((await delSingleRes.json()).items.length, 9)
  assert.equal(fs.existsSync(path.join(tempUploadDir, targetToDelete.filename)), false)

  const clearAllRes = await collageApi.DELETE({
    nextUrl: new URL('https://fixture.example/api/collage?all=1'),
  })
  assert.equal((await clearAllRes.json()).items.length, 0)
  for (let i = 2; i < 12; i++) {
    assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[i])), false)
  }
})

scenario('custom transparent cutout template saves trimmed RGBA PNG, deletes replaced/reset files, and auto-migrates legacy settings', async () => {
  // Legacy settings row from before cutout migration should upgrade automatically.
  appSettingsMap.set(
    collageServer.userCollageSettingsKey('user-tpl'),
    JSON.stringify({
      enabled: true,
      templateImageUrl: '/defaults/reaction-default.jpg',
      corner: 'top-right',
      scalePercent: 28,
    }),
  )
  activeActor = { id: 'user-tpl', email: 'tpl@fixture.example', isAdmin: false }
  const migratedGet = await (await collageSettingsApi.GET()).json()
  assert.equal(migratedGet.settings.templateImageUrl, '/defaults/reaction-default.png')
  assert.equal(migratedGet.settings.corner, 'bottom-right')
  assert.equal(migratedGet.settings.scalePercent, 38)

  const cutoutBytes = await makeTransparentCutoutPng(320, 360)
  const tpl1Res = await collageSettingsApi.POST(
    makeMultipartRequest('https://fixture.example/api/settings/collage', {
      file: new File([cutoutBytes], 'tpl1.png', { type: 'image/png' }),
    }),
  )
  assert.equal(tpl1Res.status, 201)
  const tpl1Data = await tpl1Res.json()
  const tpl1Filename = tpl1Data.settings.templateImageUrl.split('/').pop()
  assert.match(tpl1Filename, /^collage-tpl-.*\.png$/)
  const tpl1Path = path.join(tempUploadDir, tpl1Filename)
  assert.equal(fs.existsSync(tpl1Path), true)
  const tpl1Meta = await sharp(tpl1Path).metadata()
  assert.equal(tpl1Meta.hasAlpha, true)

  // Replace with 2nd cutout -> 1st custom template deleted from disk.
  const tpl2Res = await collageSettingsApi.POST(
    makeMultipartRequest('https://fixture.example/api/settings/collage', {
      file: new File([cutoutBytes], 'tpl2.png', { type: 'image/png' }),
    }),
  )
  const tpl2Filename = (await tpl2Res.json()).settings.templateImageUrl.split('/').pop()
  assert.equal(fs.existsSync(tpl1Path), false, 'old custom template deleted on replace')
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl2Filename)), true)

  // Reset to default -> 2nd custom template deleted from disk.
  await collageSettingsApi.PUT(
    makeJsonRequest('https://fixture.example/api/settings/collage', {
      templateImageUrl: collageConfig.DEFAULT_REACTION_TEMPLATE_URL,
    }),
  )
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl2Filename)), false, 'custom template deleted on reset')
})

scenario('ReactionCollageStudio UI: compact active preview, zero FB optimization UI, clickable Dán ảnh & Copy ảnh', async () => {
  const reactRoot = createRoot(document.querySelector('#root'))
  const baseSettings = collageConfig.defaultUserCollageSettings()
  const fakePngBytes = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 20, g: 160, b: 90, alpha: 1 } },
  }).png().toBuffer()
  const fakeClipboardBlob = new Blob([fakePngBytes], { type: 'image/png' })

  let clipboardWritten = 0
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      read: async () => [
        { types: ['image/png'], getType: async () => fakeClipboardBlob },
      ],
      write: async (items) => {
        for (const clip of items) await clip.data['image/png']
        clipboardWritten++
      },
    },
  })
  dom.window.ClipboardItem = class MockClipboardItem {
    constructor(data) {
      this.data = data
    }
  }

  let postedFormFiles = 0
  const composedItem = {
    id: 'item-ui-1',
    filename: 'collage-ui-1.jpg',
    url: '/uploads/content/collage-ui-1.jpg',
    downloadName: 'IMG_20261119_090000_123.jpg',
    width: 1152,
    height: 2048,
    sizeBytes: 184320,
    corner: 'bottom-left',
    createdAt: new Date().toISOString(),
  }

  global.fetch = async (url, init = {}) => {
    if (url === '/api/collage' && init.method === 'POST') {
      postedFormFiles++
      return {
        ok: true,
        json: async () => ({ item: composedItem, items: [composedItem] }),
      }
    }
    if (String(url).startsWith('/uploads/content/')) {
      return { ok: true, blob: async () => new Blob([fakePngBytes], { type: 'image/png' }) }
    }
    return { ok: true, json: async () => ({ ok: true, settings: baseSettings }) }
  }

  await React.act(async () => {
    reactRoot.render(
      React.createElement(ReactionCollageStudio, {
        initialSettings: baseSettings,
        initialItems: [],
      }),
    )
  })
  assert.ok(document.querySelector('[data-collage-paste-btn]'))
  assert.ok(document.querySelector('[data-collage-upload-btn]'))

  await React.act(async () => {
    document.querySelector('[data-collage-paste-btn]').click()
  })
  assert.equal(postedFormFiles, 1)

  const activeCard = document.querySelector('[data-collage-active-card]')
  assert.ok(activeCard, 'Compact active card renders after compose')
  assert.ok(activeCard.className.includes('max-w-lg'), 'Active card uses compact width')
  const previewWrap = document.querySelector('[data-collage-active-preview]').parentElement
  assert.ok(previewWrap.className.includes('h-36') && previewWrap.className.includes('w-36'), 'Preview thumbnail uses compact h-36 w-36 container')
  assert.equal(document.body.innerHTML.includes('max-h-[620px]'), false, 'Giant 620px preview removed')
  assert.equal(document.querySelector('[data-fb-viral-controls]'), null, 'No FB viral controls in user UI')
  assert.equal(document.body.textContent.includes('Chuẩn đề xuất'), false, 'Zero FB viral wording in user UI')
  assert.equal(document.body.textContent.includes('FB HD'), false, 'Zero FB HD badge in user UI')

  await React.act(async () => {
    document.querySelector('[data-collage-copy-btn]').click()
  })
  assert.equal(clipboardWritten, 1)

  await React.act(async () => {
    reactRoot.unmount()
  })
})

async function main() {
  try {
    for (const { name, fn } of scenarios) {
      await fn()
      console.log(`PASS ${name}`)
    }
    console.log(`RESULT=PASS reaction-collage-scenarios=${scenarios.length}`)
  } finally {
    fs.rmSync(tempUploadDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
