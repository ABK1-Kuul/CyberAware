import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logApiRequest } from '@/lib/request-logger'
import { rateLimit } from '@/lib/rate-limit'
import { requireUnifiedAuth } from '@/lib/unified-auth'
import { logAuditEvent, getClientIpFromRequest } from '@/services/audit-service'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ACCEPTED = ['.zip']

export async function POST(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: 'courses:upload', limit: 20 })
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit.limit),
    'X-RateLimit-Remaining': String(limit.remaining),
    'X-RateLimit-Reset': String(limit.reset),
  }
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many upload attempts. Please try again later.' },
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
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Upload a SCORM package (.zip).' },
        { status: 400 }
      )
    }

    const name = file.name.toLowerCase()
    const valid = ACCEPTED.some((ext) => name.endsWith(ext))
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .zip SCORM packages are accepted.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      )
    }

    // Placeholder until file storage is implemented (Milestone 2.3).
    // We create a course record; scormPath points to a placeholder.
    const baseName = file.name.replace(/\.zip$/i, '')
    const title = baseName || 'Untitled SCORM Package'
    const scormPath = `/scorm/${baseName || 'upload'}`

    const course = await prisma.course.create({
      data: {
        title,
        description: `SCORM package: ${title}. File storage not yet configured; package metadata only.`,
        version: '1.0',
        scormPath,
        enrollmentCount: 0,
      },
    })

    // Audit log: Track course upload (admin-only action)
    await logAuditEvent({
      action: 'course.upload',
      actorId: auth.user.id,
      targetId: course.id,
      details: {
        title: course.title,
        version: course.version,
        fileName: file.name,
        fileSize: file.size,
        scormPath,
      },
      ipAddress: getClientIpFromRequest(request),
      severity: 'INFO',
      complianceStatus: 'DORA-Compliant',
    })

    return NextResponse.json(
      {
        message: 'Course created successfully.',
        course: {
          id: course.id,
          title: course.title,
          version: course.version,
        },
      },
      { status: 201, headers: rateLimitHeaders }
    )
  } catch (error) {
    logger.error('Course upload error', { error })
    return NextResponse.json(
      { error: 'Failed to process upload.' },
      { status: 500 }
    )
  }
}
