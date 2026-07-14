export const linkCache = new Map<string, { data: any; expiry: number }>()

export function invalidateLinkCache(shortCode: string) {
  for (const key of linkCache.keys()) {
    if (key.endsWith(`:${shortCode}`)) {
      linkCache.delete(key)
    }
  }
}
