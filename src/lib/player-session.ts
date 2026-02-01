import { prisma } from "@/lib/prisma"
import { requireUnifiedAuth } from "@/lib/unified-auth"

export type PlayerInitialState = {
  suspendData: string | null
  lessonLocation: string | null
  h5pState: Record<string, unknown> | null
}

export type PlayerSessionResult =
  | {
      ok: true
      contentUrl: string
      contentType: "SCORM" | "H5P"
      initialState: PlayerInitialState
      enrollmentId: string
    }
  | {
      ok: false
      redirectTo: string
      status: number
    }

function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") ?? "unknown"
}

export async function resolvePlayerSession(
  request: Request,
  courseId: string
): Promise<PlayerSessionResult> {
  const auth = await requireUnifiedAuth(request, { requireCookie: true, courseId })
  if ("status" in auth) {
    if (auth.status === 401) {
      return {
        ok: false,
        redirectTo: `/api/auth/verify?courseId=${courseId}`,
        status: 401,
      }
    }
    return { ok: false, redirectTo: "/access-denied", status: auth.status }
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: auth.user.id,
        courseId,
      },
    },
    include: { course: true },
  })
  if (!enrollment) {
    return { ok: false, redirectTo: "/access-denied", status: 404 }
  }

  const session =
    (await prisma.courseSession.findFirst({
      where: { enrollmentId: enrollment.id },
      orderBy: { lastActivityAt: "desc" },
    })) ??
    (await prisma.courseSession.create({
      data: {
        enrollmentId: enrollment.id,
        userId: auth.user.id,
        courseId,
        contentType: "SCORM",
        status: "NotStarted",
        startedAt: new Date(),
      },
    }))

  const userAgent = getUserAgent(request)
  if (!session.pinnedUserAgent) {
    await prisma.courseSession.update({
      where: { id: session.id },
      data: {
        pinnedUserAgent: userAgent,
        pinnedAt: new Date(),
      },
    })
  } else if (session.pinnedUserAgent !== userAgent) {
    return { ok: false, redirectTo: "/access-denied", status: 403 }
  }

  return {
    ok: true,
    contentUrl: enrollment.course.scormPath,
    contentType: session.contentType,
    initialState: {
      suspendData: session.suspendData ?? null,
      lessonLocation: session.lessonLocation ?? null,
      h5pState: (session.h5pState as Record<string, unknown> | null) ?? null,
    },
    enrollmentId: enrollment.id,
  }
}
