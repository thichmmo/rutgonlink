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

// In-memory Prisma mock backing appSetting + user + audit logs.
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
let activeAdminAccess = {
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
const collageApi = loadBackend('app/api/collage/route.ts')
const collageSettingsApi = loadBackend('app/api/settings/collage/route.ts')
const adminUserDetailApi = loadBackend('app/api/admin/users/[id]/route.ts')
const ReactionCollageStudio = loadBackend('app/dashboard/collage/ReactionCollageStudio.tsx').default

async function makeSampleSourceImage({ width = 1080, height = 1920, withExif = true } = {}) {
  let img = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 34, g: 130, b: 210 },
    },
  })
  if (withExif) {
    img = img.withMetadata({
      exif: {
        IFD0: {
          Software: 'Android Screenshot Tool',
          Make: 'TestScreenshotDevice',
        },
      },
    })
  }
  return img.jpeg({ quality: 90 }).toBuffer()
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

scenario('default pre-cropped reaction template exists and has clean 3:4 portrait dimensions', async () => {
  const defaultPath = path.join(root, 'public', 'defaults', 'reaction-default.jpg')
  assert.equal(fs.existsSync(defaultPath), true, 'public/defaults/reaction-default.jpg must exist')
  const meta = await sharp(defaultPath).metadata()
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, 600)
  assert.equal(meta.height, 800)
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

scenario('standard user without Admin FB viral permission gets standard <=1280px collage even if requesting fbViralEnabled=true', async () => {
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

  const settingsRes = await collageSettingsApi.GET()
  assert.equal(settingsRes.status, 200)
  const settingsData = await settingsRes.json()
  assert.equal(settingsData.canUseFbViral, false)
  assert.equal(settingsData.settings.enabled, true)
  assert.equal(settingsData.settings.templateImageUrl, '/defaults/reaction-default.jpg')

  const srcBytes = await makeSampleSourceImage({ width: 1440, height: 2560 })
  const file = new File([srcBytes], 'screenshot.jpg', { type: 'image/jpeg' })
  const postRes = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file,
      corner: 'bottom-right',
      aspectPreset: 'fb-4x5',
      fbViralEnabled: 'true',
    }),
  )
  assert.equal(postRes.status, 201)
  const postData = await postRes.json()
  assert.equal(postData.canUseFbViral, false)
  assert.equal(postData.item.fbOptimized, false)
  assert.match(postData.item.downloadName, /^ghep-anh-\d{8}_\d{6}\.jpg$/)
  assert.ok(Math.max(postData.item.width, postData.item.height) <= 1280)
})

scenario('Admin grants FB viral permission -> user receives 4:5 HD (~2048px), stripped EXIF, unique hashes, and IMG_ filename; revoking removes access immediately', async () => {
  const patchGrant = await adminUserDetailApi.PATCH(
    makeJsonRequest('https://fixture.example/api/admin/users/user-standard', {
      action: 'set-fb-viral-collage',
      fbViralCollageEnabled: true,
      reason: 'Cấp quyền tối ưu ảnh đề xuất FB',
    }),
    { params: Promise.resolve({ id: 'user-standard' }) },
  )
  assert.equal(patchGrant.status, 200)
  assert.equal(auditLogs.at(-1)?.action, 'user.set-fb-viral-collage')

  activeActor = { id: 'user-standard', email: 'member@fixture.example', isAdmin: false }
  const srcBytes = await makeSampleSourceImage({ width: 1080, height: 1920, withExif: true })
  const srcExifMeta = await sharp(srcBytes).metadata()
  assert.ok(srcExifMeta.exif, 'fixture source image starts with EXIF screenshot metadata')

  const file1 = new File([srcBytes], 'paste-1.jpg', { type: 'image/jpeg' })
  const res1 = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: file1,
      corner: 'bottom-right',
      aspectPreset: 'fb-4x5',
      fbViralEnabled: 'true',
    }),
  )
  const data1 = await res1.json()
  assert.equal(data1.canUseFbViral, true)
  assert.equal(data1.item.fbOptimized, true)
  assert.equal(data1.item.aspectPreset, 'fb-4x5')
  assert.match(data1.item.downloadName, /^IMG_\d{8}_\d{6}_\d{3}\.jpg$/)
  assert.ok(data1.item.height >= 2042 && data1.item.height <= 2048)
  assert.equal(data1.item.width, Math.round((data1.item.height * 4) / 5))

  const outPath1 = path.join(tempUploadDir, data1.item.filename)
  const outBuf1 = fs.readFileSync(outPath1)
  const outMeta1 = await sharp(outBuf1).metadata()
  assert.equal(outMeta1.exif, undefined, 'old screenshot EXIF metadata must be stripped')

  // Compose the exact same input image again and verify fresh cryptographic hash.
  const file2 = new File([srcBytes], 'paste-2.jpg', { type: 'image/jpeg' })
  const res2 = await collageApi.POST(
    makeMultipartRequest('https://fixture.example/api/collage', {
      file: file2,
      corner: 'bottom-right',
      aspectPreset: 'fb-4x5',
      fbViralEnabled: 'true',
    }),
  )
  const data2 = await res2.json()
  const outBuf2 = fs.readFileSync(path.join(tempUploadDir, data2.item.filename))
  const sha1 = crypto.createHash('sha256').update(outBuf1).digest('hex')
  const sha2 = crypto.createHash('sha256').update(outBuf2).digest('hex')
  assert.notEqual(sha1, sha2, 'two FB viral exports of the same source image must have distinct hashes')

  // Revoke permission via Admin API and confirm immediate enforcement.
  const patchRevoke = await adminUserDetailApi.PATCH(
    makeJsonRequest('https://fixture.example/api/admin/users/user-standard', {
      action: 'set-fb-viral-collage',
      fbViralCollageEnabled: false,
      reason: 'Thu hồi quyền tối ưu ảnh đề xuất FB',
    }),
    { params: Promise.resolve({ id: 'user-standard' }) },
  )
  assert.equal(patchRevoke.status, 200)

  const checkAfterRevoke = await (await collageSettingsApi.GET()).json()
  assert.equal(checkAfterRevoke.canUseFbViral, false)
})

scenario('history strictly keeps 10 most recent images per user and unlinks evicted files on disk', async () => {
  activeActor = { id: 'user-prune', email: 'prune@fixture.example', isAdmin: true }
  const srcBytes = await makeSampleSourceImage({ width: 800, height: 1000, withExif: false })
  const createdFilenames = []

  for (let i = 0; i < 12; i++) {
    const file = new File([srcBytes], `batch-${i}.jpg`, { type: 'image/jpeg' })
    const res = await collageApi.POST(
      makeMultipartRequest('https://fixture.example/api/collage', {
        file,
        corner: 'top-left',
        aspectPreset: 'auto-hd',
      }),
    )
    assert.equal(res.status, 201)
    const body = await res.json()
    createdFilenames.push(body.item.filename)
    assert.ok(body.items.length <= collageConfig.MAX_COLLAGE_HISTORY)
  }

  const historyData = await (await collageApi.GET()).json()
  assert.equal(historyData.items.length, 10)

  // First 2 oldest files must be physically deleted from disk; newest 10 must remain.
  assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[0])), false, '1st oldest image unlinked')
  assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[1])), false, '2nd oldest image unlinked')
  for (let i = 2; i < 12; i++) {
    assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[i])), true, `recent image ${i} retained`)
  }

  // Delete single item and verify disk file removal.
  const targetToDelete = historyData.items[0]
  const delSingleRes = await collageApi.DELETE({
    nextUrl: new URL(`https://fixture.example/api/collage?id=${encodeURIComponent(targetToDelete.id)}`),
  })
  const delSingleData = await delSingleRes.json()
  assert.equal(delSingleData.items.length, 9)
  assert.equal(fs.existsSync(path.join(tempUploadDir, targetToDelete.filename)), false)

  // Clear all remaining items and verify all remaining files are removed from disk.
  const clearAllRes = await collageApi.DELETE({
    nextUrl: new URL('https://fixture.example/api/collage?all=1'),
  })
  const clearAllData = await clearAllRes.json()
  assert.equal(clearAllData.items.length, 0)
  for (let i = 2; i < 12; i++) {
    assert.equal(fs.existsSync(path.join(tempUploadDir, createdFilenames[i])), false)
  }
})

scenario('uploading custom reaction template replaces & deletes previous custom template file on disk, and reset cleans up too', async () => {
  activeActor = { id: 'user-tpl', email: 'tpl@fixture.example', isAdmin: false }
  const portraitBytes = await makeSampleSourceImage({ width: 720, height: 960, withExif: false })

  const tpl1Res = await collageSettingsApi.POST(
    makeMultipartRequest('https://fixture.example/api/settings/collage', {
      file: new File([portraitBytes], 'tpl1.jpg', { type: 'image/jpeg' }),
    }),
  )
  assert.equal(tpl1Res.status, 201)
  const tpl1Data = await tpl1Res.json()
  const tpl1Filename = tpl1Data.settings.templateImageUrl.split('/').pop()
  assert.match(tpl1Filename, /^collage-tpl-.*\.jpg$/)
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl1Filename)), true)

  // Upload second custom template -> first custom template file must be deleted.
  const tpl2Res = await collageSettingsApi.POST(
    makeMultipartRequest('https://fixture.example/api/settings/collage', {
      file: new File([portraitBytes], 'tpl2.jpg', { type: 'image/jpeg' }),
    }),
  )
  const tpl2Data = await tpl2Res.json()
  const tpl2Filename = tpl2Data.settings.templateImageUrl.split('/').pop()
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl1Filename)), false, 'old custom template deleted on replace')
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl2Filename)), true, 'new custom template saved')

  // Reset back to default -> second custom template file must also be deleted.
  const resetRes = await collageSettingsApi.PUT(
    makeJsonRequest('https://fixture.example/api/settings/collage', {
      templateImageUrl: collageConfig.DEFAULT_REACTION_TEMPLATE_URL,
    }),
  )
  assert.equal(resetRes.status, 200)
  assert.equal(fs.existsSync(path.join(tempUploadDir, tpl2Filename)), false, 'custom template deleted on reset to default')
})

scenario('ReactionCollageStudio UI: clickable "Dán ảnh" button pastes from clipboard, hides FB controls when unauthorized, and copies PNG to clipboard', async () => {
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
        {
          types: ['image/png'],
          getType: async () => fakeClipboardBlob,
        },
      ],
      write: async (items) => {
        // Resolve the ClipboardItem promise payload to verify PNG blob generation.
        for (const clip of items) {
          await clip.data['image/png']
        }
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
    downloadName: 'IMG_20261119_010000_123.jpg',
    width: 1638,
    height: 2048,
    sizeBytes: 184320,
    corner: 'bottom-right',
    aspectPreset: 'fb-4x5',
    fbOptimized: true,
    createdAt: new Date().toISOString(),
  }

  global.fetch = async (url, init = {}) => {
    if (url === '/api/collage' && init.method === 'POST') {
      postedFormFiles++
      return {
        ok: true,
        json: async () => ({ item: composedItem, items: [composedItem], canUseFbViral: false }),
      }
    }
    if (String(url).startsWith('/uploads/content/')) {
      return {
        ok: true,
        blob: async () => new Blob([fakePngBytes], { type: 'image/png' }),
      }
    }
    return { ok: true, json: async () => ({ ok: true, settings: baseSettings }) }
  }

  // 1. Mount as non-authorized user -> FB viral controls must NOT render.
  await React.act(async () => {
    reactRoot.render(
      React.createElement(ReactionCollageStudio, {
        initialSettings: baseSettings,
        initialCanUseFbViral: false,
        initialItems: [],
      }),
    )
  })
  assert.equal(document.querySelector('[data-fb-viral-controls]'), null, 'FB viral controls hidden for unauthorized user')
  assert.ok(document.querySelector('[data-collage-paste-btn]'), 'Clickable Dán ảnh button rendered')
  assert.ok(document.querySelector('[data-collage-upload-btn]'), 'Clickable Upload ảnh button rendered')

  // Click "Dán ảnh" directly (no Ctrl+V) -> reads clipboard and posts to /api/collage.
  await React.act(async () => {
    document.querySelector('[data-collage-paste-btn]').click()
  })
  assert.equal(postedFormFiles, 1)
  assert.ok(document.querySelector('[data-collage-copy-btn]'), 'Copy ảnh button appears after collage completes')
  assert.equal(
    document.querySelector('[data-collage-download-btn]').getAttribute('download'),
    'IMG_20261119_010000_123.jpg',
  )

  // Click "Copy ảnh" -> writes PNG ClipboardItem.
  await React.act(async () => {
    document.querySelector('[data-collage-copy-btn]').click()
  })
  assert.equal(clipboardWritten, 1)

  // 2. Mount as authorized user -> FB viral controls MUST render.
  await React.act(async () => {
    reactRoot.render(
      React.createElement(ReactionCollageStudio, {
        key: 'authorized-instance',
        initialSettings: baseSettings,
        initialCanUseFbViral: true,
        initialItems: [composedItem],
      }),
    )
  })
  assert.ok(document.querySelector('[data-fb-viral-controls]'), 'FB viral controls visible for authorized user')
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
