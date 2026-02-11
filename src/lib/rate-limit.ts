import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { logger } from "@/lib/logger"

type RateLimitOptions = {
  keyPrefix?: string
  limit?: number
  windowMs?: number
}

type Bucket = {
  count: number
  resetAt: number
}

const localBuckets = new Map<string, Bucket>()
const limiterCache = new Map<string, Ratelimit>()

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (!forwarded) return "unknown"
  const [first] = forwarded.split(",")
  return first?.trim() || "unknown"
}

function getLimiter({
  keyPrefix = "default",
  limit = 60,
  windowMs = 60_000,
}: RateLimitOptions): Ratelimit {
  if (!redis) {
    throw new Error(
      "Upstash Redis is required for rate limiting. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    )
  }
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const cacheKey = `${keyPrefix}:${limit}:${windowSeconds}`
  const existing = limiterCache.get(cacheKey)
  if (existing) return existing
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
    prefix: `ratelimit:${keyPrefix}`,
  })
  limiterCache.set(cacheKey, limiter)
  return limiter
}

function localRateLimit(
  key: string,
  { limit = 60, windowMs = 60_000 }: RateLimitOptions
): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const existing = localBuckets.get(key)

  if (!existing || now > existing.resetAt) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000))
    return { ok: false, retryAfter }
  }

  existing.count += 1
  localBuckets.set(key, existing)
  return { ok: true, retryAfter: 0 }
}

export type RateLimitResult = {
  ok: boolean
  retryAfter: number
  limit: number
  remaining: number
  reset: number
}

export async function rateLimit(
  request: Request,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const { keyPrefix = "default", limit = 60, windowMs = 60_000 } = options
  const ip = getClientIp(request)
  const identifier = `${keyPrefix}:${request.method}:${ip}`

  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Upstash Redis is required for rate limiting in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      )
    }
    if (process.env.NODE_ENV !== "test") {
      logger.warn("Upstash Redis not configured, using in-memory rate limiting.")
    }
    const localResult = localRateLimit(identifier, { limit, windowMs })
    const bucket = localBuckets.get(identifier)
    const reset = bucket?.resetAt ?? Date.now() + windowMs
    return {
      ...localResult,
      limit,
      remaining: localResult.ok ? Math.max(0, limit - (bucket?.count ?? 1)) : 0,
      reset,
    }
  }

  const ratelimit = getLimiter({ keyPrefix, limit, windowMs })
  const result = await ratelimit.limit(identifier)
  const reset = result.reset
  const remaining = result.remaining
  if (result.success) {
    return {
      ok: true,
      retryAfter: 0,
      limit,
      remaining,
      reset,
    }
  }
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
  return {
    ok: false,
    retryAfter,
    limit,
    remaining: 0,
    reset,
  }
}
