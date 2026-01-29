import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ACCEPTED = ['.zip']

export async function POST(request: Request) {
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

    return NextResponse.json(
      {
        message: 'Course created successfully.',
        course: {
          id: course.id,
          title: course.title,
          version: course.version,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Course upload error', { error })
    return NextResponse.json(
      { error: 'Failed to process upload.' },
      { status: 500 }
    )
  }
}
