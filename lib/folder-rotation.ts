/**
 * Folder Rotation Logic
 *
 * Manages daily rotation of URL folders for link shortening.
 * Each folder is active for one full day (00:00-23:59 VN timezone).
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// In-memory cache for active folder indices
const activeFolderCache = new Map<string, {index: number, date: string}>()

/**
 * Get the active folder index for a given date
 * @param startDate - When folder rotation started
 * @param totalFolders - Total number of folders
 * @returns Index of the active folder (0-based)
 */
export function getActiveFolderIndex(
  startDate: Date,
  totalFolders: number
): number {
  if (totalFolders === 0) return 0

  // Convert to VN timezone
  const nowVN = new Date(Date.now() + VN_OFFSET_MS)
  const startVN = new Date(startDate.getTime() + VN_OFFSET_MS)

  // Reset to start of day (00:00:00)
  nowVN.setHours(0, 0, 0, 0)
  startVN.setHours(0, 0, 0, 0)

  // Calculate days since start
  const daysSinceStart = Math.floor(
    (nowVN.getTime() - startVN.getTime()) / (24 * 60 * 60 * 1000)
  )

  // Return folder index (cycles through folders)
  return daysSinceStart % totalFolders
}

export function getVietnamStartOfTodayUtc(referenceDate = new Date()): Date {
  const nowVN = new Date(referenceDate.getTime() + VN_OFFSET_MS)
  nowVN.setHours(0, 0, 0, 0)
  return new Date(nowVN.getTime() - VN_OFFSET_MS)
}

export function getFolderRotationStartDateForActiveIndex(
  activeIndex: number,
  totalFolders: number,
  referenceDate = new Date(),
): Date {
  if (totalFolders <= 0) return referenceDate
  const normalizedIndex = ((Math.floor(activeIndex) % totalFolders) + totalFolders) % totalFolders
  return new Date(getVietnamStartOfTodayUtc(referenceDate).getTime() - normalizedIndex * ONE_DAY_MS)
}

/**
 * Get the active folder index with caching
 * @param linkId - Link ID for cache key
 * @param startDate - When folder rotation started
 * @param totalFolders - Total number of folders
 * @returns Index of the active folder (0-based)
 */
export function getActiveFolderIndexCached(
  linkId: string,
  startDate: Date,
  totalFolders: number
): number {
  // Get current date in VN timezone (YYYY-MM-DD)
  const nowVN = new Date(Date.now() + VN_OFFSET_MS)
  const today = nowVN.toISOString().split('T')[0]
  const cacheKey = `${linkId}:${today}`

  // Check cache
  const cached = activeFolderCache.get(cacheKey)
  if (cached && cached.date === today) {
    return cached.index
  }

  // Calculate and cache
  const index = getActiveFolderIndex(startDate, totalFolders)
  activeFolderCache.set(cacheKey, {index, date: today})

  // Clean old cache entries (keep only today's entries)
  for (const [key, value] of activeFolderCache.entries()) {
    if (value.date !== today) {
      activeFolderCache.delete(key)
    }
  }

  return index
}

/**
 * Get URLs from the active folder
 * @param folders - Array of folders with order and urls
 * @param startDate - When folder rotation started
 * @returns Array of URLs from the active folder
 */
export function getActiveFolderUrls(
  folders: Array<{order: number, urls: string}>,
  startDate: Date
): string[] {
  if (folders.length === 0) return []

  // Sort folders by order
  const sortedFolders = folders.sort((a, b) => a.order - b.order)

  // Get active folder index
  const activeIndex = getActiveFolderIndex(startDate, folders.length)
  const activeFolder = sortedFolders[activeIndex]

  // Parse URLs (newline-separated)
  const urls = activeFolder.urls
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean)

  return urls
}

/**
 * Get active folder info (for UI display)
 * @param folders - Array of folders with order, name, and urls
 * @param startDate - When folder rotation started
 * @returns Active folder info or null
 */
export function getActiveFolderInfo(
  folders: Array<{order: number, name: string, urls: string}>,
  startDate: Date
): {index: number, name: string, urlCount: number} | null {
  if (folders.length === 0) return null

  const sortedFolders = folders.sort((a, b) => a.order - b.order)
  const activeIndex = getActiveFolderIndex(startDate, folders.length)
  const activeFolder = sortedFolders[activeIndex]

  const urlCount = activeFolder.urls
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean).length

  return {
    index: activeIndex,
    name: activeFolder.name,
    urlCount
  }
}

/**
 * Clear cache (useful for testing)
 */
export function clearFolderCache() {
  activeFolderCache.clear()
}
