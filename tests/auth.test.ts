import { resolvePlayerSession } from "@/lib/player-session"
import { issueSessionJwt, requireUnifiedAuth } from "@/lib/unified-auth"
import { prisma, resetPrismaMocks } from "@/lib/prisma"
import { certificateService } from "@/services/certificate-service"
import { POST as postCourseState } from "@/app/api/course/[courseId]/state/route"

jest.mock("@/lib/unified-auth", () => {
  const actual = jest.requireActual("@/lib/unified-auth")
  return {
    ...actual,
    requireUnifiedAuth: jest.fn(),
  }
})

jest.mock("@/services/certificate-service", () => ({
  certificateService: {
    generateAndEmail: jest.fn(),
  },
}))

const mockPrisma = prisma
const mockRequireUnifiedAuth = requireUnifiedAuth as jest.Mock
const mockCertificateService = certificateService as jest.Mocked<typeof certificateService>

const buildRequest = (headers: Record<string, string>) =>
  new Request("http://local.player/course-1", { headers })

describe("Player auth security", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    resetPrismaMocks()
    process.env.JWT_SECRET = "test-secret-key-for-jwt-auth-32-chars"
  })

  test("redirects to verify route when cookie is missing", async () => {
    const request = buildRequest({ "user-agent": "UA-1" })
    const result = await resolvePlayerSession(request, "course-1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.redirectTo).toBe("/api/auth/verify?courseId=course-1")
      expect(result.status).toBe(401)
    }
  })

  test("denies access when pinned user-agent mismatches", async () => {
    const token = issueSessionJwt({
      userId: "user-1",
      authType: "magic-token",
      courseId: "course-1",
      ttlSeconds: 86400,
    })

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "learner",
      team: "A",
      avatarUrl: "",
    })

    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "enroll-1",
      course: { scormPath: "/scorm/demo" },
    } as any)

    mockPrisma.courseSession.findFirst.mockResolvedValue({
      id: "session-1",
      pinnedUserAgent: "UA-ORIGINAL",
      suspendData: null,
      lessonLocation: null,
      h5pState: null,
      contentType: "SCORM",
    } as any)

    const request = buildRequest({
      "user-agent": "UA-SPOOF",
      cookie: `session_auth=${token}`,
    })

    const result = await resolvePlayerSession(request, "course-1")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.redirectTo).toBe("/access-denied")
      expect(result.status).toBe(403)
    }
  })

  test("first visit pins the user-agent", async () => {
    const token = issueSessionJwt({
      userId: "user-1",
      authType: "magic-token",
      courseId: "course-1",
      ttlSeconds: 86400,
    })

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "learner",
      team: "A",
      avatarUrl: "",
    })

    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "enroll-1",
      course: { scormPath: "/scorm/demo" },
    } as any)

    mockPrisma.courseSession.findFirst.mockResolvedValue({
      id: "session-1",
      pinnedUserAgent: null,
      suspendData: null,
      lessonLocation: null,
      h5pState: null,
      contentType: "SCORM",
    } as any)

    mockPrisma.courseSession.update.mockResolvedValue({
      id: "session-1",
    } as any)

    const request = buildRequest({
      "user-agent": "UA-NEW",
      cookie: `session_auth=${token}`,
    })

    const result = await resolvePlayerSession(request, "course-1")
    expect(result.ok).toBe(true)
    expect(mockPrisma.courseSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pinnedUserAgent: "UA-NEW",
        }),
      })
    )
  })
})

describe("Course state success trigger", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    resetPrismaMocks()
  })

  test("triggers certificate generation when status is completed", async () => {
    mockRequireUnifiedAuth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Jane Doe",
        email: "jane@example.com",
        role: "learner",
        team: "A",
        avatarUrl: "",
      },
      authType: "magic-token",
      clientIp: "1.1.1.1",
      userAgent: "UA-1",
    })

    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "enroll-1",
      course: { title: "Security 101", scormPath: "/scorm/demo" },
    } as any)

    mockPrisma.courseSession.findUnique.mockResolvedValue({
      id: "session-1",
      certificateSent: false,
      status: "InProgress",
      h5pState: null,
    } as any)

    mockPrisma.courseSession.update
      .mockResolvedValueOnce({
        id: "session-1",
        certificateSent: false,
        status: "Completed",
        lessonLocation: null,
        score: 90,
      } as any)
      .mockResolvedValueOnce({
        id: "session-1",
        certificateSent: true,
        status: "Completed",
      } as any)

    const request = new Request("http://local/api/course/course-1/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "SCORM",
        cmiData: { cmi: { completion_status: "completed" } },
        score: 90,
      }),
    })

    await postCourseState(request, { params: Promise.resolve({ courseId: "course-1" }) })

    expect(mockCertificateService.generateAndEmail).toHaveBeenCalledWith("user-1", "course-1")
    expect(mockPrisma.courseSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificateSent: true,
        }),
      })
    )
  })
})
