export const DEFAULT_REACTION_TEMPLATE_URL = '/defaults/reaction-default.jpg'
export const MAX_COLLAGE_HISTORY = 10
export const MAX_COLLAGE_INPUT_BYTES = 12 * 1024 * 1024

export const REACTION_CORNERS = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
] as const

export type ReactionCorner = (typeof REACTION_CORNERS)[number]

export const COLLAGE_ASPECT_PRESETS = [
  'fb-4x5',
  'auto-hd',
  'fb-1x1',
] as const

export type CollageAspectPreset = (typeof COLLAGE_ASPECT_PRESETS)[number]

export type UserCollageSettings = {
  enabled: boolean
  templateImageUrl: string
  corner: ReactionCorner
  scalePercent: number
  aspectPreset: CollageAspectPreset
  fbViralEnabled: boolean
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
  aspectPreset: CollageAspectPreset
  fbOptimized: boolean
  createdAt: string
}

export const REACTION_CORNER_LABELS: Record<ReactionCorner, string> = {
  'bottom-right': 'Dưới phải',
  'bottom-left': 'Dưới trái',
  'top-right': 'Trên phải',
  'top-left': 'Trên trái',
}

export const COLLAGE_ASPECT_LABELS: Record<CollageAspectPreset, string> = {
  'fb-4x5': 'Dọc 4:5 (Chuẩn Feed FB)',
  'auto-hd': 'Tỷ lệ gốc (Nét HD 2048px)',
  'fb-1x1': 'Vuông 1:1 (2048×2048)',
}

export function defaultUserCollageSettings(): UserCollageSettings {
  return {
    enabled: true,
    templateImageUrl: DEFAULT_REACTION_TEMPLATE_URL,
    corner: 'bottom-right',
    scalePercent: 28,
    aspectPreset: 'fb-4x5',
    fbViralEnabled: true,
  }
}

export function isAllowedTemplateImageUrl(value: string): boolean {
  if (value === DEFAULT_REACTION_TEMPLATE_URL) return true
  return /^\/uploads\/content\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(value)
}

export function normalizeUserCollageSettings(input: unknown): UserCollageSettings {
  const base = defaultUserCollageSettings()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>

  if (typeof raw.enabled === 'boolean') base.enabled = raw.enabled
  if (typeof raw.templateImageUrl === 'string' && isAllowedTemplateImageUrl(raw.templateImageUrl.trim())) {
    base.templateImageUrl = raw.templateImageUrl.trim()
  }
  if (typeof raw.corner === 'string' && (REACTION_CORNERS as readonly string[]).includes(raw.corner)) {
    base.corner = raw.corner as ReactionCorner
  }
  const parsedScale = Number(raw.scalePercent)
  if (Number.isFinite(parsedScale)) {
    base.scalePercent = Math.max(18, Math.min(42, Math.round(parsedScale)))
  }
  if (typeof raw.aspectPreset === 'string' && (COLLAGE_ASPECT_PRESETS as readonly string[]).includes(raw.aspectPreset)) {
    base.aspectPreset = raw.aspectPreset as CollageAspectPreset
  }
  if (typeof raw.fbViralEnabled === 'boolean') base.fbViralEnabled = raw.fbViralEnabled
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
    const corner = typeof raw.corner === 'string' && (REACTION_CORNERS as readonly string[]).includes(raw.corner)
      ? (raw.corner as ReactionCorner)
      : 'bottom-right'
    const aspectPreset = typeof raw.aspectPreset === 'string' && (COLLAGE_ASPECT_PRESETS as readonly string[]).includes(raw.aspectPreset)
      ? (raw.aspectPreset as CollageAspectPreset)
      : 'auto-hd'
    items.push({
      id: raw.id,
      filename: raw.filename,
      url: raw.url,
      downloadName: raw.downloadName,
      width: Math.max(1, Number(raw.width) || 1),
      height: Math.max(1, Number(raw.height) || 1),
      sizeBytes: Math.max(0, Number(raw.sizeBytes) || 0),
      corner,
      aspectPreset,
      fbOptimized: raw.fbOptimized === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    })
  }
  return items.slice(0, MAX_COLLAGE_HISTORY)
}
