const store = new Map<string, number[]>()

// Dọn entries cũ mỗi 30 giây để tránh memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of store.entries()) {
    const recent = timestamps.filter(t => now - t < 60_000)
    if (recent.length === 0) store.delete(key)
    else store.set(key, recent)
  }
}, 30_000)

/**
 * Kiểm tra rate limit theo IP.
 * @returns true nếu còn trong giới hạn, false nếu bị chặn
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = store.get(key) || []
  const recent = timestamps.filter(t => now - t < windowMs)
  recent.push(now)
  store.set(key, recent)
  return recent.length <= limit
}

export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return (req.headers as Headers).get('x-real-ip') || 'unknown'
}
