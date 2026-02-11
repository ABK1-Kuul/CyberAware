import { NextResponse } from "next/server"
import type { RateLimitResult } from "./rate-limit"

/**
 * Creates rate limit headers for API responses
 */
export function createRateLimitHeaders(limit: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": String(limit.reset),
  }
}

/**
 * Creates a 429 Too Many Requests response with rate limit headers
 */
export function createRateLimitResponse(limit: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests." },
    {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfter),
        ...createRateLimitHeaders(limit),
      },
    }
  )
}
