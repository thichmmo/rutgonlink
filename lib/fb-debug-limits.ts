export const FB_DEBUG_MAX_LINKS_PER_RUN = 10
export const FB_DEBUG_BATCH_RETRY_MINUTES = 5
export const FB_DEBUG_BATCH_RETRY_MS = FB_DEBUG_BATCH_RETRY_MINUTES * 60 * 1000
export const FB_DEBUG_BLOCK_BACKOFF_MINUTES = 60
export const FB_DEBUG_BLOCK_BACKOFF_MS = FB_DEBUG_BLOCK_BACKOFF_MINUTES * 60 * 1000
export const FB_DEBUG_URL_COOLDOWN_MINUTES = 10
export const FB_DEBUG_URL_COOLDOWN_MS = FB_DEBUG_URL_COOLDOWN_MINUTES * 60 * 1000
export const FB_DEBUG_INVALID_PARAMETER_RETRY_LIMIT = 5

export function clampFbDebugRunLimit(limit: number) {
  if (!Number.isFinite(limit)) return FB_DEBUG_MAX_LINKS_PER_RUN
  return Math.min(Math.max(1, Math.floor(limit)), FB_DEBUG_MAX_LINKS_PER_RUN)
}
