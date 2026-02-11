import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createEnrollment } from '@/lib/data'
import { prisma } from '@/lib/prisma'
import { DatabaseError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { requireUnifiedAuth } from '@/lib/unified-auth'
import { logAuditEvent, getClientIpFromRequest } from '@/services/audit-service'

const bodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  courseId: z.string().min(1, 'courseId is required'),
})

export async function POST(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: 'enrollments:post', limit: 60 })
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit.limit),
    'X-RateLimit-Remaining': String(limit.remaining),
    'X-RateLimit-Reset': String(limit.reset),
  }
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many enrollment requests.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfter),
          ...rateLimitHeaders,
        },
      }
    )
  }
  const auth = await requireUnifiedAuth(request)
  if ('status' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        { error: 'Validation failed', details: msg },
        { status: 400 }
      )
    }
    const { userId, courseId } = parsed.data
    if (auth.user.role !== 'admin' && auth.user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot create enrollment for another user.' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const admin = await prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
    })
    const actorId = admin?.id ?? userId

    const enrollment = await createEnrollment(userId, courseId, actorId)

    // Audit log: Track enrollment creation for compliance
    await logAuditEvent({
      action: 'enrollment.create',
      actorId: auth.user.id,
      targetId: enrollment.id,
      details: {
        userId,
        courseId,
        courseTitle: course.title,
        userName: user.name,
        userEmail: user.email,
      },
      ipAddress: getClientIpFromRequest(request),
      severity: auth.user.role === 'admin' ? 'INFO' : 'INFO',
    })

    return NextResponse.json(
      {
        message: 'Enrollment created.',
        enrollment: {
          id: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          status: enrollment.status,
        },
      },
      { status: 201, headers: rateLimitHeaders }
    )
  } catch (e) {
    if (e instanceof DatabaseError && e.message.includes('already exists')) {
      return NextResponse.json(
        { error: 'Enrollment already exists for this user and course.' },
        { status: 409 }
      )
    }
    logger.error('Enrollments API error', { error: e })
    return NextResponse.json(
      { error: 'Failed to create enrollment.' },
      { status: 500 }
    )
  }
}
