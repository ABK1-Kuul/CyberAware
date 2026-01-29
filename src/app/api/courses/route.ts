import { NextResponse } from 'next/server'
import { getCourses } from '@/lib/data'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10) || 10))
    const data = await getCourses(page, pageSize)
    return NextResponse.json(data)
  } catch (e) {
    logger.error('GET /api/courses error', { error: e })
    return NextResponse.json({ error: 'Failed to fetch courses.' }, { status: 500 })
  }
}
