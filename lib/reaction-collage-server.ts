import { randomInt, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { CONTENT_UPLOAD_ROUTE, getContentUploadDirectory, resolveContentUploadPath } from '@/lib/content-upload'
import {
  defaultUserCollageSettings,
  isAllowedTemplateImageUrl,
  LEGACY_DEFAULT_REACTION_TEMPLATE_URL,
  MAX_COLLAGE_HISTORY,
  MAX_COLLAGE_INPUT_BYTES,
  normalizeCollageHistory,
  normalizeUserCollageSettings,
  REACTION_CORNERS,
  type CollageHistoryItem,
  type ReactionCorner,
  type UserCollageSettings,
} from '@/lib/reaction-collage-config'

export const FB_VIRAL_COLLAGE_ACCESS_KEY = 'fb_viral_collage_users'

export function userCollageSettingsKey(userId: string) {
  return `user_collage_settings:${userId}`
}

export function userCollageHistoryKey(userId: string) {
  return `user_collage_history:${userId}`
}

export function isImplicitFbViralAdminUser(user: { email: string; adminRole?: string | null }) {
  const ownerEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return (
    (Boolean(ownerEmail) && user.email.toLowerCase() === ownerEmail) ||
    user.adminRole === 'owner' ||
    user.adminRole === 'ops'
  )
}

export async function getFbViralAllowedUserIds(): Promise<Set<string>> {
  try {
    const appSetting = (prisma as unknown as { appSetting?: typeof prisma.appSetting }).appSetting
    if (typeof appSetting?.findUnique !== 'function') return new Set()
    const row = await appSetting.findUnique({ where: { key: FB_VIRAL_COLLAGE_ACCESS_KEY } })
    if (!row?.value) return new Set()
    const parsed = JSON.parse(row.value) as { userIds?: unknown }
    if (!Array.isArray(parsed.userIds)) return new Set()
    return new Set(parsed.userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

export async function setUserFbViralCollageAccess(userId: string, enabled: boolean): Promise<boolean> {
  const current = await getFbViralAllowedUserIds()
  if (enabled) current.add(userId)
  else current.delete(userId)
  const payload = JSON.stringify({ userIds: [...current], updatedAt: new Date().toISOString() })
  await prisma.appSetting.upsert({
    where: { key: FB_VIRAL_COLLAGE_ACCESS_KEY },
    create: { key: FB_VIRAL_COLLAGE_ACCESS_KEY, value: payload },
    update: { value: payload },
  })
  return enabled
}

export async function canActorUseFbViralCollage(actor: { id: string; isAdmin: boolean }): Promise<boolean> {
  if (actor.isAdmin) return true
  const allowed = await getFbViralAllowedUserIds()
  return allowed.has(actor.id)
}

export async function getUserCollageSettings(userId: string): Promise<UserCollageSettings> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: userCollageSettingsKey(userId) } })
    if (!row?.value) return defaultUserCollageSettings()
    return normalizeUserCollageSettings(JSON.parse(row.value))
  } catch {
    return defaultUserCollageSettings()
  }
}

async function safeDeleteUploadFilename(filename: string) {
  // Delete only our own collage-* / collage-tpl-* files inside uploads/content.
  if (!/^collage-(?:tpl-)?[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(filename)) return
  const resolved = resolveContentUploadPath(filename)
  if (!resolved) return
  await unlink(resolved).catch(() => {})
}

export async function saveUserCollageSettings(
  userId: string,
  patch: Partial<UserCollageSettings>,
): Promise<UserCollageSettings> {
  const previous = await getUserCollageSettings(userId)
  const merged = normalizeUserCollageSettings({ ...previous, ...patch })
  const key = userCollageSettingsKey(userId)
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  })

  // Reclaim the user's previous custom template file on disk when replaced or reset to default.
  if (
    previous.templateImageUrl !== merged.templateImageUrl &&
    previous.templateImageUrl.startsWith(`${CONTENT_UPLOAD_ROUTE}/collage-tpl-`)
  ) {
    const oldFilename = previous.templateImageUrl.slice(CONTENT_UPLOAD_ROUTE.length + 1)
    await safeDeleteUploadFilename(oldFilename)
  }

  return merged
}

export async function normalizeCutoutTemplatePng(inputBytes: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(inputBytes)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  if (width < 16 || height < 16) {
    throw new Error('Ảnh mẫu quá nhỏ hoặc định dạng không hỗ trợ')
  }

  // Trim outer transparent margins so the segmented subject aligns flush against bottom corners.
  let minAlpha = 255
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha < minAlpha) minAlpha = alpha
      if (alpha > 12) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  let pipeline = sharp(inputBytes).rotate().ensureAlpha()
  if (minAlpha < 220 && maxX >= minX && maxY >= minY) {
    pipeline = pipeline.extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
  }

  return pipeline
    .resize(720, 720, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .toColorspace('srgb')
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function saveUserReactionTemplateUpload(userId: string, inputBytes: Buffer): Promise<UserCollageSettings> {
  if (!inputBytes.byteLength || inputBytes.byteLength > MAX_COLLAGE_INPUT_BYTES) {
    throw new Error('Ảnh mẫu không hợp lệ hoặc vượt quá 12MB')
  }
  const normalizedBuffer = await normalizeCutoutTemplatePng(inputBytes)

  const directory = getContentUploadDirectory()
  await mkdir(directory, { recursive: true })
  const filename = `collage-tpl-${randomUUID()}.png`
  await writeFile(join(directory, filename), normalizedBuffer)
  return saveUserCollageSettings(userId, {
    templateImageUrl: `${CONTENT_UPLOAD_ROUTE}/${filename}`,
    enabled: true,
  })
}

export async function getUserCollageHistory(userId: string): Promise<CollageHistoryItem[]> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: userCollageHistoryKey(userId) } })
    if (!row?.value) return []
    return normalizeCollageHistory(JSON.parse(row.value))
  } catch {
    return []
  }
}

function resolveDefaultTemplateFilePath(): string {
  const cwd = /*turbopackIgnore: true*/ process.cwd()
  const direct = resolve(cwd, 'public', 'defaults', 'reaction-default.png')
  if (existsSync(direct)) return direct
  return resolve(cwd, '..', '..', 'public', 'defaults', 'reaction-default.png')
}

async function loadTemplateImageBuffer(templateImageUrl: string): Promise<Buffer> {
  if (
    templateImageUrl !== LEGACY_DEFAULT_REACTION_TEMPLATE_URL &&
    isAllowedTemplateImageUrl(templateImageUrl) &&
    templateImageUrl.startsWith(`${CONTENT_UPLOAD_ROUTE}/`)
  ) {
    const filename = templateImageUrl.slice(CONTENT_UPLOAD_ROUTE.length + 1)
    const customPath = resolveContentUploadPath(filename)
    if (customPath && existsSync(customPath)) {
      try {
        return await readFile(customPath)
      } catch {
        // Fall through to default cutout template if custom file was manually removed.
      }
    }
  }
  return readFile(resolveDefaultTemplateFilePath())
}

function buildDownloadName(fbOptimized: boolean, now = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const stamp = `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}_${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`
  if (fbOptimized) {
    // Natural mobile camera filename pattern favored over generic web export names.
    return `IMG_${stamp}_${pad(randomInt(100, 999), 3)}.jpg`
  }
  return `ghep-anh-${stamp}.jpg`
}

export type ComposeCollageOptions = {
  corner?: ReactionCorner
  scalePercent?: number
  includeOverlay?: boolean
}

export async function composeReactionCollageBuffer(
  sourceBytes: Buffer,
  settings: UserCollageSettings,
  canUseFbViral: boolean,
  overrides: ComposeCollageOptions = {},
): Promise<{
  buffer: Buffer
  width: number
  height: number
  corner: ReactionCorner
  fbOptimized: boolean
}> {
  if (!sourceBytes.byteLength || sourceBytes.byteLength > MAX_COLLAGE_INPUT_BYTES) {
    throw new Error('Ảnh đầu vào không hợp lệ hoặc vượt quá 12MB')
  }

  const corner: ReactionCorner =
    overrides.corner && (REACTION_CORNERS as readonly string[]).includes(overrides.corner)
      ? overrides.corner
      : settings.corner
  const scalePercent =
    overrides.scalePercent !== undefined && Number.isFinite(Number(overrides.scalePercent))
      ? Math.max(20, Math.min(58, Math.round(Number(overrides.scalePercent))))
      : settings.scalePercent
  // Enforce Admin permission silently at the server layer without exposing any user UI toggle.
  const fbOptimized = Boolean(canUseFbViral)
  const includeOverlay = overrides.includeOverlay !== undefined ? overrides.includeOverlay : settings.enabled

  const sourceMeta = await sharp(sourceBytes).rotate().metadata()
  const srcW = sourceMeta.width || 0
  const srcH = sourceMeta.height || 0
  if (srcW < 16 || srcH < 16) throw new Error('Ảnh quá nhỏ hoặc định dạng ảnh không hỗ trợ')

  let canvasW: number
  let canvasH: number
  let baseCanvasBuffer: Buffer

  if (fbOptimized) {
    // Preserve natural source aspect ratio at ~2048px HD ceiling while adding subtle variation so each export has fresh metadata-free bytes.
    const maxEdge = 2048 - randomInt(0, 3) * 2
    if (srcW >= srcH) {
      canvasW = maxEdge
      canvasH = Math.max(64, Math.round((srcH * maxEdge) / srcW))
    } else {
      canvasH = maxEdge
      canvasW = Math.max(64, Math.round((srcW * maxEdge) / srcH))
    }
    const brightnessJitter = 1 + randomInt(-5, 8) / 1000
    const saturationJitter = 1 + randomInt(4, 16) / 1000

    baseCanvasBuffer = await sharp(sourceBytes)
      .rotate()
      .resize(canvasW, canvasH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .modulate({ brightness: brightnessJitter, saturation: saturationJitter })
      .toColorspace('srgb')
      .png()
      .toBuffer()
  } else {
    const maxStandardEdge = 1280
    const scale = Math.min(1, maxStandardEdge / Math.max(srcW, srcH))
    canvasW = Math.max(64, Math.round(srcW * scale))
    canvasH = Math.max(64, Math.round(srcH * scale))
    baseCanvasBuffer = await sharp(sourceBytes)
      .rotate()
      .resize(canvasW, canvasH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .toColorspace('srgb')
      .png()
      .toBuffer()
  }

  let pipeline = sharp(baseCanvasBuffer)

  if (includeOverlay) {
    const templateBuffer = await loadTemplateImageBuffer(settings.templateImageUrl)
    const tplMeta = await sharp(templateBuffer).rotate().metadata()
    const tplW = tplMeta.width || 1
    const tplH = tplMeta.height || 1

    const refEdge = Math.min(canvasW, canvasH)
    const scaleJitter = fbOptimized ? 1 + randomInt(-10, 11) / 1000 : 1
    let overlayW = Math.round(refEdge * ((scalePercent * scaleJitter) / 100))
    let overlayH = Math.round(overlayW * (tplH / tplW))

    const clampFactor = Math.min(
      1,
      Math.round(canvasW * 0.56) / Math.max(1, overlayW),
      Math.round(canvasH * 0.58) / Math.max(1, overlayH),
    )
    if (clampFactor < 1) {
      overlayW = Math.round(overlayW * clampFactor)
      overlayH = Math.round(overlayH * clampFactor)
    }
    overlayW = Math.max(48, Math.min(canvasW, overlayW))
    overlayH = Math.max(48, Math.min(canvasH, overlayH))

    const cutoutOverlay = await sharp(templateBuffer)
      .rotate()
      .resize(overlayW, overlayH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .png()
      .toBuffer()

    // Composite cutout flush against the bottom-left or bottom-right corner with 0px gap.
    const overlayLeft = corner === 'bottom-right' ? Math.max(0, canvasW - overlayW) : 0
    const overlayTop = Math.max(0, canvasH - overlayH)

    pipeline = pipeline.composite([
      { input: cutoutOverlay, left: overlayLeft, top: overlayTop, blend: 'over' },
    ])
  }

  const finalBuffer = fbOptimized
    ? await pipeline
        .sharpen({ sigma: 0.65 })
        .toColorspace('srgb')
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer()
    : await pipeline
        .toColorspace('srgb')
        .jpeg({ quality: 85 })
        .toBuffer()

  return {
    buffer: finalBuffer,
    width: canvasW,
    height: canvasH,
    corner,
    fbOptimized,
  }
}

export async function createUserCollageAndPruneHistory(
  userId: string,
  sourceBytes: Buffer,
  canUseFbViral: boolean,
  overrides: ComposeCollageOptions = {},
): Promise<{ item: CollageHistoryItem; items: CollageHistoryItem[] }> {
  const settings = await getUserCollageSettings(userId)
  const composed = await composeReactionCollageBuffer(sourceBytes, settings, canUseFbViral, overrides)

  const directory = getContentUploadDirectory()
  await mkdir(directory, { recursive: true })
  const id = randomUUID()
  const filename = `collage-${id}.jpg`
  await writeFile(join(directory, filename), composed.buffer)

  const item: CollageHistoryItem = {
    id,
    filename,
    url: `${CONTENT_UPLOAD_ROUTE}/${filename}`,
    downloadName: buildDownloadName(composed.fbOptimized),
    width: composed.width,
    height: composed.height,
    sizeBytes: composed.buffer.byteLength,
    corner: composed.corner,
    createdAt: new Date().toISOString(),
  }

  const existing = await getUserCollageHistory(userId)
  const all = [item, ...existing]
  const kept = all.slice(0, MAX_COLLAGE_HISTORY)
  const evicted = all.slice(MAX_COLLAGE_HISTORY)

  const key = userCollageHistoryKey(userId)
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(kept) },
    update: { value: JSON.stringify(kept) },
  })

  // Delete 11th+ oldest collage files from disk immediately to keep host storage bounded.
  await Promise.all(evicted.map((old) => safeDeleteUploadFilename(old.filename)))

  return { item, items: kept }
}

export async function deleteUserCollageHistoryItem(
  userId: string,
  itemId: string,
): Promise<CollageHistoryItem[]> {
  const existing = await getUserCollageHistory(userId)
  const target = existing.find((entry) => entry.id === itemId)
  const kept = existing.filter((entry) => entry.id !== itemId)
  const key = userCollageHistoryKey(userId)
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(kept) },
    update: { value: JSON.stringify(kept) },
  })
  if (target) await safeDeleteUploadFilename(target.filename)
  return kept
}

export async function clearUserCollageHistory(userId: string): Promise<CollageHistoryItem[]> {
  const existing = await getUserCollageHistory(userId)
  const key = userCollageHistoryKey(userId)
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: '[]' },
    update: { value: '[]' },
  })
  await Promise.all(existing.map((old) => safeDeleteUploadFilename(old.filename)))
  return []
}
