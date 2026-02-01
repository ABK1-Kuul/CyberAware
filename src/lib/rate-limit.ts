type RateLimitOptions = {
  keyPrefix?: string
  limit?: number
  windowMs?: number
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(
  request: Request,
  { keyPrefix = 'default', limit = 60, windowMs = 60_000 }: RateLimitOptions = {}
): { ok: boolean; retryAfter: number } {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const key = `${keyPrefix}:${request.method}:${ip}`
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000))
    return { ok: false, retryAfter }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { ok: true, retryAfter: 0 }
}
