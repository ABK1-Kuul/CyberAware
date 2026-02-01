import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { requireUnifiedAuth, issueSessionJwt, hashClientIp } from "@/lib/unified-auth"

const COOKIE_NAME = "session_auth"
const COOKIE_TTL_SECONDS = 60 * 60 * 24

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown"
}

function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") ?? "unknown"
}

function getCourseId(request: Request): string | null {
  const url = new URL(request.url)
  const courseId = url.searchParams.get("courseId")
  return courseId && courseId.trim() ? courseId.trim() : null
}

function getContentType(request: Request): "SCORM" | "H5P" {
  const url = new URL(request.url)
  const value = url.searchParams.get("contentType")
  return value === "H5P" ? "H5P" : "SCORM"
}

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "auth:verify", limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many verification attempts." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const courseId = getCourseId(request)
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 })
  }

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: auth.user.id,
        courseId,
      },
    },
    select: { id: true },
  })
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found." }, { status: 404 })
  }

  const contentType = getContentType(request)
  const session = await prisma.courseSession.upsert({
    where: {
      enrollmentId_contentType: {
        enrollmentId: enrollment.id,
        contentType,
      },
    },
    create: {
      enrollmentId: enrollment.id,
      userId: auth.user.id,
      courseId,
      contentType,
      status: "NotStarted",
      startedAt: new Date(),
    },
    update: {},
  })

  if (auth.authType === "magic-token" && (!session.pinnedIp || !session.pinnedUserAgent)) {
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    await prisma.courseSession.update({
      where: { id: session.id },
      data: {
        pinnedIp: hashClientIp(clientIp),
        pinnedUserAgent: userAgent,
        pinnedAt: new Date(),
      },
    })
  }

  const token = issueSessionJwt({
    userId: auth.user.id,
    authType: auth.authType,
    courseId,
    ttlSeconds: COOKIE_TTL_SECONDS,
  })

  const redirectUrl = new URL(`/player/${courseId}`, request.url)
  const response = NextResponse.redirect(redirectUrl)
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: COOKIE_TTL_SECONDS,
    path: "/",
  })
  return response
}
