import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { clampProgress } from "@/lib/constants"
import { generateCertificate, sendCertificateEmail } from "@/lib/certificates"
import { summarizeCmiData, isCompletionMet } from "@/lib/scorm"
import { randomUUID } from "crypto"

const bodySchema = z.object({
  contentType: z.enum(["SCORM", "H5P"]),
  cmiData: z.record(z.any()).optional(),
  suspendData: z.string().optional(),
  lessonLocation: z.string().optional(),
  lessonStatus: z.string().optional(),
  lesson_status: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  h5pState: z.record(z.any()).optional(),
})

function getLessonStatus(body: z.infer<typeof bodySchema>): string | undefined {
  return body.lessonStatus ?? body.lesson_status
}

function getQueryContentType(request: Request): "SCORM" | "H5P" | null {
  const url = new URL(request.url)
  const value = url.searchParams.get("contentType")
  if (!value) return null
  if (value === "SCORM" || value === "H5P") return value
  return null
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = data
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function getScormValue(data: Record<string, unknown>, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = getNestedValue(data, path)
    if (typeof value === "string" && value.trim()) return value
  }
  return undefined
}

function getScormLessonStatus(data: Record<string, unknown>): string | undefined {
  return getScormValue(data, [
    "cmi.core.lesson_status",
    "cmi.lesson_status",
    "cmi.completion_status",
    "cmi.success_status",
  ])
}

async function getEnrollment(userId: string, courseId: string) {
  return prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    include: { course: true },
  })
}

async function getOrCreateSession({
  enrollmentId,
  courseId,
  userId,
  contentType,
}: {
  enrollmentId: string
  courseId: string
  userId: string
  contentType: "SCORM" | "H5P"
}) {
  const existing = await prisma.courseSession.findUnique({
    where: {
      enrollmentId_contentType: {
        enrollmentId,
        contentType,
      },
    },
  })
  if (existing) return existing
  return prisma.courseSession.create({
    data: {
      enrollmentId,
      courseId,
      userId,
      contentType,
      status: "NotStarted",
      startedAt: new Date(),
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "course:state:get", limit: 180 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many state fetch requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { courseId } = await params
  const contentType = getQueryContentType(request)
  if (!courseId || !contentType) {
    return NextResponse.json(
      { error: "courseId and contentType are required." },
      { status: 400 }
    )
  }

  const enrollment = await getEnrollment(auth.user.id, courseId)
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found." }, { status: 404 })
  }

  const session = await getOrCreateSession({
    enrollmentId: enrollment.id,
    courseId,
    userId: auth.user.id,
    contentType,
  })

  return NextResponse.json({
    enrollmentId: enrollment.id,
    contentType,
    suspendData: session.suspendData ?? null,
    lessonLocation: session.lessonLocation ?? null,
    h5pState: session.h5pState ?? null,
    score: session.score ?? null,
    status: session.status,
    certificateSent: session.certificateSent,
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  return handleWrite(request, context)
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  return handleWrite(request, context)
}

async function handleWrite(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "course:state:write", limit: 300 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many state update requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { courseId } = await params
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid state payload.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const lessonStatus =
    getLessonStatus(parsed.data) ??
    (parsed.data.cmiData ? getScormLessonStatus(parsed.data.cmiData) : undefined)
  const score = parsed.data.score
  const contentType = parsed.data.contentType

  const enrollment = await getEnrollment(auth.user.id, courseId)
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found." }, { status: 404 })
  }

  const session = await getOrCreateSession({
    enrollmentId: enrollment.id,
    courseId,
    userId: auth.user.id,
    contentType,
  })

  let suspendData = parsed.data.suspendData
  let lessonLocation = parsed.data.lessonLocation
  if (contentType === "SCORM" && parsed.data.cmiData) {
    suspendData =
      suspendData ??
      getScormValue(parsed.data.cmiData, ["cmi.suspend_data"])
    lessonLocation =
      lessonLocation ??
      getScormValue(parsed.data.cmiData, ["cmi.core.lesson_location", "cmi.location"])
  }

  const normalizedStatus = lessonStatus?.toLowerCase()
  const passed =
    normalizedStatus === "passed" ||
    (typeof score === "number" && score >= 80)

  const scormSummary =
    contentType === "SCORM" && parsed.data.cmiData
      ? summarizeCmiData(parsed.data.cmiData)
      : null

  const completionFromScorm = scormSummary
    ? isCompletionMet(scormSummary.completionStatus, scormSummary.successStatus)
    : false

  const nextStatus = passed
    ? "Passed"
    : completionFromScorm
      ? "Completed"
      : session.status === "NotStarted"
        ? "InProgress"
        : session.status

  const now = new Date()

  const updatedSession = await prisma.courseSession.update({
    where: { id: session.id },
    data: {
      suspendData,
      lessonLocation,
      h5pState: parsed.data.h5pState ?? session.h5pState,
      score: typeof score === "number" ? score : session.score,
      status: nextStatus,
      lastActivityAt: now,
      completedAt: nextStatus === "Passed" || nextStatus === "Completed" ? now : session.completedAt,
    },
  })

  if (contentType === "SCORM" && parsed.data.cmiData && scormSummary) {
    await prisma.scormData.upsert({
      where: { enrollmentId: enrollment.id },
      create: {
        enrollmentId: enrollment.id,
        cmiData: parsed.data.cmiData,
        lastLocation: scormSummary.lastLocation ?? lessonLocation ?? "",
        completionStatus: scormSummary.completionStatus,
        successStatus: scormSummary.successStatus,
        scoreRaw: scormSummary.scoreRaw,
        scoreMin: scormSummary.scoreMin,
        scoreMax: scormSummary.scoreMax,
        totalTimeSeconds: scormSummary.totalTimeSeconds,
        sessionTimeSeconds: scormSummary.sessionTimeSeconds,
        lastCommitAt: now,
      },
      update: {
        cmiData: parsed.data.cmiData,
        lastLocation: scormSummary.lastLocation ?? lessonLocation ?? "",
        completionStatus: scormSummary.completionStatus,
        successStatus: scormSummary.successStatus,
        scoreRaw: scormSummary.scoreRaw,
        scoreMin: scormSummary.scoreMin,
        scoreMax: scormSummary.scoreMax,
        totalTimeSeconds: scormSummary.totalTimeSeconds,
        sessionTimeSeconds: scormSummary.sessionTimeSeconds,
        lastCommitAt: now,
      },
    })
  }

  if (passed && !updatedSession.certificateSent) {
    const existingCertificate = await prisma.certificate.findUnique({
      where: { enrollmentId: enrollment.id },
    })

    if (!existingCertificate) {
      const certificateId = randomUUID()
      const completionDate = enrollment.completedAt ?? now
      const certificate = await generateCertificate({
        recipientName: auth.user.name || "Jone Doe",
        courseTitle: enrollment.course.title,
        completionDate,
        certificateId,
      })

      const record = await prisma.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          path: certificate.publicPath,
          uuid: certificateId,
          issuedAt: completionDate,
        },
      })

      const appBaseUrl = process.env.APP_BASE_URL ?? ""
      const certificateUrl = `${appBaseUrl}${record.path}`
      await sendCertificateEmail({
        to: auth.user.email,
        name: auth.user.name || "Jone Doe",
        courseTitle: enrollment.course.title,
        certificateUrl,
      })
    }

    await prisma.courseSession.update({
      where: { id: session.id },
      data: { certificateSent: true },
    })
  }

  if (passed || completionFromScorm) {
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "Completed",
        progress: clampProgress(100),
        completedAt: now,
      },
    })
  }

  return NextResponse.json({
    enrollmentId: enrollment.id,
    contentType,
    status: updatedSession.status,
    score: updatedSession.score,
    lessonLocation: updatedSession.lessonLocation,
    certificateSent: updatedSession.certificateSent,
  })
}
