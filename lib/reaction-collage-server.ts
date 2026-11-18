import { randomInt, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { CONTENT_UPLOAD_ROUTE, getContentUploadDirectory, resolveContentUploadPath } from '@/lib/content-upload'
import {
  COLLAGE_ASPECT_PRESETS,
  defaultUserCollageSettings,
  isAllowedTemplateImageUrl,
  MAX_COLLAGE_HISTORY,
  MAX_COLLAGE_INPUT_BYTES,
  normalizeCollageHistory,
  normalizeUserCollageSettings,
  REACTION_CORNERS,
  type CollageAspectPreset,
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

export async function saveUserReactionTemplateUpload(userId: string, inputBytes: Buffer): Promise<UserCollageSettings> {
  if (!inputBytes.byteLength || inputBytes.byteLength > MAX_COLLAGE_INPUT_BYTES) {
    throw new Error('Ảnh mẫu không hợp lệ hoặc vượt quá 12MB')
  }
  // Normalize the fixed template once to a crisp 600x800 (3:4 FaceTime portrait) JPEG.
  const normalizedBuffer = await sharp(inputBytes)
    .rotate()
    .resize(600, 800, { fit: 'cover', position: 'north', kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.6 })
    .toColorspace('srgb')
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer()

  const directory = getContentUploadDirectory()
  await mkdir(directory, { recursive: true })
  const filename = `collage-tpl-${randomUUID()}.jpg`
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
  const direct = resolve(cwd, 'public', 'defaults', 'reaction-default.jpg')
  if (existsSync(direct)) return direct
  return resolve(cwd, '..', '..', 'public', 'defaults', 'reaction-default.jpg')
}

async function loadTemplateImageBuffer(templateImageUrl: string): Promise<Buffer> {
  if (
    isAllowedTemplateImageUrl(templateImageUrl) &&
    templateImageUrl.startsWith(`${CONTENT_UPLOAD_ROUTE}/`)
  ) {
    const filename = templateImageUrl.slice(CONTENT_UPLOAD_ROUTE.length + 1)
    const customPath = resolveContentUploadPath(filename)
    if (customPath && existsSync(customPath)) {
      try {
        return await readFile(customPath)
      } catch {
        // Fall through to default template if custom file was manually removed.
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
  aspectPreset?: CollageAspectPreset
  fbViralEnabled?: boolean
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
  aspectPreset: CollageAspectPreset
  fbOptimized: boolean
}> {
  if (!sourceBytes.byteLength || sourceBytes.byteLength > MAX_COLLAGE_INPUT_BYTES) {
    throw new Error('Ảnh đầu vào không hợp lệ hoặc vượt quá 12MB')
  }

  const corner: ReactionCorner = overrides.corner && (REACTION_CORNERS as readonly string[]).includes(overrides.corner)
    ? overrides.corner
    : settings.corner
  const scalePercent = overrides.scalePercent !== undefined && Number.isFinite(Number(overrides.scalePercent))
    ? Math.max(18, Math.min(42, Math.round(Number(overrides.scalePercent))))
    : settings.scalePercent
  const requestedAspect: CollageAspectPreset = overrides.aspectPreset && (COLLAGE_ASPECT_PRESETS as readonly string[]).includes(overrides.aspectPreset)
    ? overrides.aspectPreset
    : settings.aspectPreset
  const wantsViral = overrides.fbViralEnabled !== undefined ? overrides.fbViralEnabled : settings.fbViralEnabled
  // Enforce Admin permission strictly at the server layer.
  const fbOptimized = Boolean(canUseFbViral && wantsViral)
  const effectiveAspect: CollageAspectPreset = fbOptimized ? requestedAspect : 'auto-hd'
  const includeOverlay = overrides.includeOverlay !== undefined ? overrides.includeOverlay : settings.enabled

  const sourceMeta = await sharp(sourceBytes).rotate().metadata()
  const srcW = sourceMeta.width || 0
  const srcH = sourceMeta.height || 0
  if (srcW < 16 || srcH < 16) throw new Error('Ảnh quá nhỏ hoặc định dạng ảnh không hỗ trợ')

  let canvasW: number
  let canvasH: number
  let baseCanvasBuffer: Buffer

  if (fbOptimized) {
    // Micro-modulate brightness/saturation slightly on each export so perceptual & cryptographic
    // hashes look freshly captured while improving clarity on Facebook's sRGB CDN pipeline.
    const brightnessJitter = 1 + (randomInt(-5, 8) / 1000)
    const saturationJitter = 1 + (randomInt(4, 16) / 1000)

    if (effectiveAspect === 'fb-4x5' || effectiveAspect === 'fb-1x1') {
      // Vary longest edge by 0..4 even pixels around 2048 so dimensions/DCT blocks never repeat verbatim.
      const edgeDelta = randomInt(0, 3) * 2
      canvasH = 2048 - edgeDelta
      canvasW = effectiveAspect === 'fb-4x5' ? Math.round((canvasH * 4) / 5) : canvasH
      const targetRatio = canvasW / canvasH
      const srcRatio = srcW / srcH

      if (Math.abs(srcRatio - targetRatio) <= 0.14) {
        baseCanvasBuffer = await sharp(sourceBytes)
          .rotate()
          .resize(canvasW, canvasH, { fit: 'cover', position: 'attention', kernel: sharp.kernel.lanczos3 })
          .modulate({ brightness: brightnessJitter, saturation: saturationJitter })
          .toColorspace('srgb')
          .png()
          .toBuffer()
      } else {
        // Preserve 100% of screenshot/photo text without cropping by floating the crisp image over an ambient blurred backdrop.
        const backdrop = await sharp(sourceBytes)
          .rotate()
          .resize(canvasW, canvasH, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
          .blur(28)
          .modulate({ brightness: 0.76, saturation: 1.05 })
          .toColorspace('srgb')
          .png()
          .toBuffer()
        const foreground = await sharp(sourceBytes)
          .rotate()
          .resize(canvasW, canvasH, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
          .modulate({ brightness: brightnessJitter, saturation: saturationJitter })
          .toColorspace('srgb')
          .png()
          .toBuffer()
        baseCanvasBuffer = await sharp(backdrop)
          .composite([{ input: foreground, gravity: 'center' }])
          .png()
          .toBuffer()
      }
    } else {
      // 'auto-hd': normalize longest edge to ~2048px (Facebook's HD ceiling) preserving original aspect ratio.
      const maxEdge = 2048 - randomInt(0, 3) * 2
      if (srcW >= srcH) {
        canvasW = maxEdge
        canvasH = Math.max(64, Math.round((srcH * maxEdge) / srcW))
      } else {
        canvasH = maxEdge
        canvasW = Math.max(64, Math.round((srcW * maxEdge) / srcH))
      }
      baseCanvasBuffer = await sharp(sourceBytes)
        .rotate()
        .resize(canvasW, canvasH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .modulate({ brightness: brightnessJitter, saturation: saturationJitter })
        .toColorspace('srgb')
        .png()
        .toBuffer()
    }
  } else {
    // Standard non-FB-viral mode for accounts without Admin FB optimization permission.
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
    const scaleJitter = fbOptimized ? (1 + randomInt(-8, 9) / 1000) : 1
    let overlayW = Math.round(canvasW * ((scalePercent * scaleJitter) / 100))
    let overlayH = Math.round((overlayW * 4) / 3)
    const maxOverlayH = Math.round(canvasH * 0.46)
    if (overlayH > maxOverlayH) {
      overlayH = maxOverlayH
      overlayW = Math.round((overlayH * 3) / 4)
    }
    overlayW = Math.max(72, Math.min(canvasW - 24, overlayW))
    overlayH = Math.max(96, Math.min(canvasH - 24, overlayH))

    const radius = Math.max(10, Math.round(overlayW * 0.085))
    const strokeWidth = Math.max(2, Math.round(overlayW * 0.012))
    const maskSvg = Buffer.from(
      `<svg width="${overlayW}" height="${overlayH}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${overlayW}" height="${overlayH}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
    )
    const borderSvg = Buffer.from(
      `<svg width="${overlayW}" height="${overlayH}" xmlns="http://www.w3.org/2000/svg"><rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${overlayW - strokeWidth}" height="${overlayH - strokeWidth}" rx="${Math.max(4, radius - strokeWidth / 2)}" ry="${Math.max(4, radius - strokeWidth / 2)}" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="${strokeWidth}"/></svg>`,
    )

    const resizedTemplate = await sharp(templateBuffer)
      .rotate()
      .resize(overlayW, overlayH, { fit: 'cover', position: 'north', kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .toBuffer()

    const roundedOverlay = await sharp(resizedTemplate)
      .composite([
        { input: maskSvg, blend: 'dest-in' },
        { input: borderSvg, blend: 'over' },
      ])
      .png()
      .toBuffer()

    const shadowPad = Math.max(10, Math.round(overlayW * 0.07))
    const shadowW = overlayW + shadowPad * 2
    const shadowH = overlayH + shadowPad * 2
    const shadowSvg = Buffer.from(
      `<svg width="${shadowW}" height="${shadowH}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(3, Math.round(shadowPad * 0.34))}" result="blur"/><feOffset in="blur" dx="0" dy="${Math.max(2, Math.round(shadowPad * 0.28))}" result="offset"/><feComponentTransfer in="offset"><feFuncA type="linear" slope="0.42"/></feComponentTransfer></filter></defs><rect x="${shadowPad}" y="${shadowPad}" width="${overlayW}" height="${overlayH}" rx="${radius}" ry="${radius}" fill="#000000" filter="url(#ds)"/></svg>`,
    )

    const baseMargin = Math.max(14, Math.round(Math.min(canvasW, canvasH) * 0.032))
    const jitterX = fbOptimized ? randomInt(-4, 5) : 0
    const jitterY = fbOptimized ? randomInt(-4, 5) : 0
    const rawLeft = corner.endsWith('right')
      ? canvasW - overlayW - baseMargin + jitterX
      : baseMargin + jitterX
    const rawTop = corner.startsWith('bottom')
      ? canvasH - overlayH - baseMargin + jitterY
      : baseMargin + jitterY

    const overlayLeft = Math.max(shadowPad, Math.min(canvasW - overlayW - shadowPad, rawLeft))
    const overlayTop = Math.max(shadowPad, Math.min(canvasH - overlayH - shadowPad, rawTop))

    pipeline = pipeline.composite([
      { input: shadowSvg, left: overlayLeft - shadowPad, top: overlayTop - shadowPad },
      { input: roundedOverlay, left: overlayLeft, top: overlayTop },
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
    aspectPreset: effectiveAspect,
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
    aspectPreset: composed.aspectPreset,
    fbOptimized: composed.fbOptimized,
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
