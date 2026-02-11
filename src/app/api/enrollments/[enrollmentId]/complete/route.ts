import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { clampProgress } from '@/lib/constants'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { requireUnifiedAuth } from '@/lib/unified-auth'
import { logAuditEvent, getClientIpFromRequest } from '@/services/audit-service'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  logApiRequest(_request)
  const limit = await rateLimit(_request, { keyPrefix: 'enrollments:complete', limit: 60 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many completion requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }
  const auth = await requireUnifiedAuth(_request)
  if ('status' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { enrollmentId } = await params
    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    })
    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }
    if (auth.user.role !== 'admin' && enrollment.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot complete another user enrollment.' },
        { status: 403 }
      )
    }

    const previousStatus = enrollment.status
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'Completed',
        progress: clampProgress(100),
        completedAt: new Date(),
      },
    })

    // Audit log: Track enrollment completion
    await logAuditEvent({
      action: 'enrollment.complete',
      actorId: auth.user.id,
      targetId: enrollmentId,
      details: {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        previousStatus,
        newStatus: 'Completed',
      },
      ipAddress: getClientIpFromRequest(_request),
      severity: 'INFO',
    })

    return NextResponse.json({
      message: 'Enrollment marked complete.',
      enrollmentId,
    })
  } catch (e) {
    logger.error('Complete enrollment error', { error: e })
    return NextResponse.json(
      { error: 'Failed to update enrollment.' },
      { status: 500 }
    )
  }
}
