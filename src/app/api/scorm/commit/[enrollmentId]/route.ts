import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { clampProgress } from '@/lib/constants'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { summarizeCmiData, isCompletionMet, type CmiData } from '@/lib/scorm'
import { requireUnifiedAuth } from '@/lib/unified-auth'

const bodySchema = z.object({
  cmiData: z.record(z.any()),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: 'scorm:commit', limit: 240 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many commit requests.' },
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

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid SCORM commit payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const cmiData = parsed.data.cmiData as CmiData
    const summary = summarizeCmiData(cmiData)

    const existingLocation = enrollment.scormData?.lastLocation ?? ''
    const nextLocation = summary.lastLocation || existingLocation
    const completed = isCompletionMet(summary.completionStatus, summary.successStatus)
    const progressMeasure = summary.progressMeasure
    const nextProgress =
      progressMeasure !== null && Number.isFinite(progressMeasure)
        ? clampProgress(progressMeasure * 100)
        : completed
          ? 100
          : enrollment.progress

    const nextStatus = completed
      ? 'Completed'
      : enrollment.status === 'NotStarted'
        ? 'InProgress'
        : enrollment.status

    const nextCompletedAt =
      completed && !enrollment.completedAt ? new Date() : enrollment.completedAt

    const updated = await prisma.$transaction(async (tx) => {
      const scormData = await tx.scormData.upsert({
        where: { enrollmentId },
        create: {
          enrollmentId,
          cmiData,
          lastLocation: nextLocation,
          completionStatus: summary.completionStatus,
          successStatus: summary.successStatus,
          scoreRaw: summary.scoreRaw,
          scoreMin: summary.scoreMin,
          scoreMax: summary.scoreMax,
          totalTimeSeconds: summary.totalTimeSeconds,
          sessionTimeSeconds: summary.sessionTimeSeconds,
          lastCommitAt: new Date(),
        },
        update: {
          cmiData,
          lastLocation: nextLocation,
          completionStatus: summary.completionStatus,
          successStatus: summary.successStatus,
          scoreRaw: summary.scoreRaw,
          scoreMin: summary.scoreMin,
          scoreMax: summary.scoreMax,
          totalTimeSeconds: summary.totalTimeSeconds,
          sessionTimeSeconds: summary.sessionTimeSeconds,
          lastCommitAt: new Date(),
        },
      })

      const enrollmentUpdate =
        nextStatus !== enrollment.status ||
        nextProgress !== enrollment.progress ||
        nextCompletedAt !== enrollment.completedAt
          ? await tx.enrollment.update({
              where: { id: enrollmentId },
              data: {
                status: nextStatus,
                progress: nextProgress,
                completedAt: nextCompletedAt,
              },
            })
          : enrollment

      return { scormData, enrollment: enrollmentUpdate }
    })

    return NextResponse.json({
      enrollmentId,
      status: updated.enrollment.status,
      progress: updated.enrollment.progress,
      lastLocation: updated.scormData.lastLocation,
      completionStatus: updated.scormData.completionStatus ?? null,
      successStatus: updated.scormData.successStatus ?? null,
      scoreRaw: updated.scormData.scoreRaw ?? null,
      scoreMin: updated.scormData.scoreMin ?? null,
      scoreMax: updated.scormData.scoreMax ?? null,
      totalTimeSeconds: updated.scormData.totalTimeSeconds ?? null,
      sessionTimeSeconds: updated.scormData.sessionTimeSeconds ?? null,
      lastCommitAt: updated.scormData.lastCommitAt?.toISOString() ?? null,
    })
  } catch (error) {
    logger.error('SCORM commit error', { error })
    return NextResponse.json(
      { error: 'Failed to commit SCORM data.' },
      { status: 500 }
    )
  }
}
