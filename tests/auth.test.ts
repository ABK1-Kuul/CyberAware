import { resolvePlayerSession } from "@/lib/player-session"
import { issueSessionJwt } from "@/lib/unified-auth"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    enrollment: {
      findUnique: jest.fn(),
    },
    courseSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const buildRequest = (headers: Record<string, string>) =>
  new Request("http://local.player/course-1", { headers })

describe("Player auth security", () => {
  beforeEach(() => {
    jest.resetAllMocks()
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
