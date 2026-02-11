import { NextResponse } from 'next/server'
import { getUsers } from '@/lib/data'
import { logger } from '@/lib/logger'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { requireUnifiedAuth } from '@/lib/unified-auth'

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: 'users:get', limit: 120 })
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit.limit),
    'X-RateLimit-Remaining': String(limit.remaining),
    'X-RateLimit-Reset': String(limit.reset),
  }
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfter),
          ...rateLimitHeaders,
        },
      }
    )
  }
  const auth = await requireUnifiedAuth(request, ['admin'])
  if ('status' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10) || 10))
    const data = await getUsers(page, pageSize)
    return NextResponse.json(data, { headers: rateLimitHeaders })
  } catch (e) {
    logger.error('GET /api/users error', { error: e })
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 })
  }
}
