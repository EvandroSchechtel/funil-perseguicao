// In-memory rate limiter for login attempts
// Will be replaced by Redis-based solution in Phase 1

interface AttemptRecord {
  count: number
  resetAt: number
}

const store = new Map<string, AttemptRecord>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export function recordFailedAttempt(key: string): { blocked: boolean; remaining: number } {
  const now = Date.now()
  const record = store.get(key)

  if (!record || record.resetAt <= now) {
    // Fresh window
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { blocked: false, remaining: MAX_ATTEMPTS - 1 }
  }

  record.count++
  const remaining = Math.max(0, MAX_ATTEMPTS - record.count)
  const blocked = record.count >= MAX_ATTEMPTS

  return { blocked, remaining }
}

export function isBlocked(key: string): boolean {
  const now = Date.now()
  const record = store.get(key)

  if (!record) return false
  if (record.resetAt <= now) {
    store.delete(key)
    return false
  }

  return record.count >= MAX_ATTEMPTS
}

export function clearAttempts(key: string): void {
  store.delete(key)
}

export function loginRateLimitKey(ip: string, email: string): string {
  return `login:${ip}:${email.toLowerCase()}`
}

// Clean up expired entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) store.delete(key)
    }
  }, 60_000)
}
