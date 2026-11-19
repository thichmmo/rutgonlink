export const DEFAULT_REACTION_TEMPLATE_URL = '/defaults/reaction-default.png'
export const LEGACY_DEFAULT_REACTION_TEMPLATE_URL = '/defaults/reaction-default.jpg'
export const MAX_COLLAGE_HISTORY = 10
export const MAX_COLLAGE_INPUT_BYTES = 12 * 1024 * 1024

export const REACTION_CORNERS = [
  'bottom-left',
  'bottom-right',
] as const

export type ReactionCorner = (typeof REACTION_CORNERS)[number]

export type UserCollageSettings = {
  enabled: boolean
  templateImageUrl: string
  corner: ReactionCorner
  scalePercent: number
}

export type CollageHistoryItem = {
  id: string
  filename: string
  url: string
  downloadName: string
  width: number
  height: number
  sizeBytes: number
  corner: ReactionCorner
  createdAt: string
}

export const REACTION_CORNER_LABELS: Record<ReactionCorner, string> = {
  'bottom-left': 'Dưới trái',
  'bottom-right': 'Dưới phải',
}

export function defaultUserCollageSettings(): UserCollageSettings {
  return {
    enabled: true,
    templateImageUrl: DEFAULT_REACTION_TEMPLATE_URL,
    corner: 'bottom-left',
    scalePercent: 38,
  }
}

export function isAllowedTemplateImageUrl(value: string): boolean {
  if (value === DEFAULT_REACTION_TEMPLATE_URL || value === LEGACY_DEFAULT_REACTION_TEMPLATE_URL) {
    return true
  }
  return /^\/uploads\/content\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(value)
}

export function normalizeUserCollageSettings(input: unknown): UserCollageSettings {
  const base = defaultUserCollageSettings()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>

  if (typeof raw.enabled === 'boolean') base.enabled = raw.enabled

  let migratedFromLegacyDefault = false
  if (typeof raw.templateImageUrl === 'string') {
    const trimmed = raw.templateImageUrl.trim()
    if (trimmed === LEGACY_DEFAULT_REACTION_TEMPLATE_URL) {
      base.templateImageUrl = DEFAULT_REACTION_TEMPLATE_URL
      migratedFromLegacyDefault = true
    } else if (isAllowedTemplateImageUrl(trimmed)) {
      base.templateImageUrl = trimmed
    }
  }

  // Upgrade legacy top corners to bottom flush corners.
  if (raw.corner === 'top-left' || raw.corner === 'bottom-left') {
    base.corner = 'bottom-left'
  } else if (raw.corner === 'top-right' || raw.corner === 'bottom-right') {
    base.corner = 'bottom-right'
  }

  const parsedScale = Number(raw.scalePercent)
  if (Number.isFinite(parsedScale)) {
    // Bump old 28% rectangular preset to natural 38% cutout scale upon default migration.
    const nextScale = migratedFromLegacyDefault && Math.round(parsedScale) === 28 ? 38 : parsedScale
    base.scalePercent = Math.max(20, Math.min(58, Math.round(nextScale)))
  }

  return base
}

export function normalizeCollageHistory(input: unknown): CollageHistoryItem[] {
  if (!Array.isArray(input)) return []
  const items: CollageHistoryItem[] = []
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    if (
      typeof raw.id !== 'string' ||
      typeof raw.filename !== 'string' ||
      !/^[A-Za-z0-9_-]+\.jpg$/i.test(raw.filename) ||
      typeof raw.url !== 'string' ||
      typeof raw.downloadName !== 'string'
    ) {
      continue
    }
    const corner: ReactionCorner =
      raw.corner === 'bottom-right' || raw.corner === 'top-right' ? 'bottom-right' : 'bottom-left'
    items.push({
      id: raw.id,
      filename: raw.filename,
      url: raw.url,
      downloadName: raw.downloadName,
      width: Math.max(1, Number(raw.width) || 1),
      height: Math.max(1, Number(raw.height) || 1),
      sizeBytes: Math.max(0, Number(raw.sizeBytes) || 0),
      corner,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    })
  }
  return items.slice(0, MAX_COLLAGE_HISTORY)
}
