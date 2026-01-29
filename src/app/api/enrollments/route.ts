import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createEnrollment } from '@/lib/data'
import { prisma } from '@/lib/prisma'
import { DatabaseError } from '@/lib/errors'
import { logger } from '@/lib/logger'

const bodySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  courseId: z.string().min(1, 'courseId is required'),
})

export async function POST(request: Request) {
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
      { status: 201 }
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
