/**
 * Minimal in-memory cache for last-good Anthropic responses per user.
 * Used as fallback when Anthropic is down or rate-limited. Each user
 * gets one slot per route ('chat' or 'scan-now'); cache TTL is 30 min.
 *
 * Memory-only — survives within process lifetime but resets on restart.
 * Acceptable: Anthropic outages are rare + brief, restart loses ~min-old
 * fallbacks but new outages immediately repopulate from next success.
 */
type CacheEntry = { value: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_CAP = 5_000

export function setCached(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  if (cache.size > CACHE_CAP) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
}

export function getCached<T = unknown>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value as T
}
