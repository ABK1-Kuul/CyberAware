import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { clampProgress } from '@/lib/constants'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
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

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'Completed',
        progress: clampProgress(100),
        completedAt: new Date(),
      },
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
