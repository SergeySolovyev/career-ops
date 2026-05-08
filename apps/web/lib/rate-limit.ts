/**
 * Rate limiter with two backends:
 *  - Upstash Redis (when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars set)
 *  - In-memory Map fallback (default, log-only mode)
 *
 * Mode controlled by RATE_LIMIT_MODE env var:
 *  - 'log' (default): console.warn on excess, never blocks (production safety net for first 48h)
 *  - 'enforce': returns 429 NextResponse on excess
 *
 * Day 4 ships in 'log' mode without Upstash. Day 6 adds Upstash. Day +2 flips to 'enforce'.
 */

import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Mode = 'log' | 'enforce'

function getMode(): Mode {
  return process.env.RATE_LIMIT_MODE === 'enforce' ? 'enforce' : 'log'
}

// In-memory fallback — sliding window per identifier.
// Capped at 10k entries (LRU eviction); approximate but cheap.
const memBucket = new Map<string, { count: number; resetAt: number }>()
const MEM_CAP = 10_000

function memoryLimit(
  id: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  let bucket = memBucket.get(id)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs }
  }
  bucket.count++
  memBucket.set(id, bucket)
  // LRU eviction — drop oldest when over cap
  if (memBucket.size > MEM_CAP) {
    const firstKey = memBucket.keys().next().value
    if (firstKey) memBucket.delete(firstKey)
  }
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetMs: bucket.resetAt - now,
  }
}

// Lazy Upstash init — only when env vars present at runtime
let upstashRatelimit: Ratelimit | null = null
let upstashTried = false
function getUpstashRatelimit(limit: number, windowMs: number): Ratelimit | null {
  if (upstashTried) return upstashRatelimit
  upstashTried = true
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const redis = new Redis({ url, token })
    upstashRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: true,
    })
    return upstashRatelimit
  } catch (e) {
    console.error('[rate-limit] Upstash init failed', e)
    return null
  }
}

export type RateLimitConfig = {
  /** Limit identifier scope (e.g. 'chat', 'scan-now', 'apply') */
  scope: string
  /** Max requests per window */
  limit: number
  /** Window in milliseconds */
  windowMs: number
}

/**
 * Check rate limit for a request. Returns null on success, or a 429 NextResponse
 * when in 'enforce' mode and limit exceeded. In 'log' mode (default), only logs
 * on excess — never blocks.
 */
export async function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
  userId?: string,
): Promise<NextResponse | null> {
  const id = userId
    ? `user:${userId}:${config.scope}`
    : `ip:${getIp(req)}:${config.scope}`

  let ok = true
  let remaining = config.limit
  let resetMs = config.windowMs

  const upstash = getUpstashRatelimit(config.limit, config.windowMs)
  if (upstash) {
    try {
      const r = await upstash.limit(id)
      ok = r.success
      remaining = r.remaining
      resetMs = r.reset - Date.now()
    } catch (e) {
      console.error('[rate-limit] upstash check failed, falling back to memory', e)
      const r = memoryLimit(id, config.limit, config.windowMs)
      ok = r.ok
      remaining = r.remaining
      resetMs = r.resetMs
    }
  } else {
    const r = memoryLimit(id, config.limit, config.windowMs)
    ok = r.ok
    remaining = r.remaining
    resetMs = r.resetMs
  }

  if (!ok) {
    const mode = getMode()
    console.warn(
      `[rate-limit] ${mode === 'enforce' ? 'BLOCK' : 'LOG'} ${id} ` +
      `(${config.scope}: ${config.limit}/${config.windowMs}ms, resetIn=${Math.ceil(resetMs / 1000)}s)`,
    )
    if (mode === 'enforce') {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetMs / 1000)),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetMs / 1000)),
          },
        },
      )
    }
  }
  return null
}

function getIp(req: Request): string {
  // Vercel forwards real IP via x-forwarded-for; first entry is real client
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

// Pre-configured limits per route (matches plan spec)
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat:    { scope: 'chat',    limit: 10, windowMs: 60_000 },
  scanNow: { scope: 'scan-now', limit: 3,  windowMs: 60_000 },
  apply:   { scope: 'apply',   limit: 30, windowMs: 60_000 },
}
