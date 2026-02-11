import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { requireUnifiedAuth } from '@/lib/unified-auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: 'scorm:initialize', limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many initialize requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  try {
    const { enrollmentId } = await params
    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { scormData: true },
    })
    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }
    const auth = await requireUnifiedAuth(request, {
      requireCookie: true,
      courseId: enrollment.courseId,
    })
    if ('status' in auth) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    if (auth.user.role !== 'admin' && enrollment.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Enrollment access denied.' },
        { status: 403 }
      )
    }

    if (enrollment.status === 'NotStarted') {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'InProgress' },
      })
    }

    const scormData =
      enrollment.scormData ??
      (await prisma.scormData.create({
        data: {
          enrollmentId,
          cmiData: {},
          lastLocation: '',
        },
      }))

    return NextResponse.json({
      enrollmentId,
      cmiData: scormData.cmiData ?? {},
      lastLocation: scormData.lastLocation ?? '',
      completionStatus: scormData.completionStatus ?? null,
      successStatus: scormData.successStatus ?? null,
      scoreRaw: scormData.scoreRaw ?? null,
      scoreMin: scormData.scoreMin ?? null,
      scoreMax: scormData.scoreMax ?? null,
      totalTimeSeconds: scormData.totalTimeSeconds ?? null,
      sessionTimeSeconds: scormData.sessionTimeSeconds ?? null,
      lastCommitAt: scormData.lastCommitAt?.toISOString() ?? null,
    })
  } catch (error) {
    logger.error('SCORM initialize error', { error })
    return NextResponse.json(
      { error: 'Failed to initialize SCORM session.' },
      { status: 500 }
    )
  }
}
