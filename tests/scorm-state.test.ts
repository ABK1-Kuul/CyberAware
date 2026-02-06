import { requireUnifiedAuth } from "@/lib/unified-auth"
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

const buildRequest = (payload: Record<string, unknown>) =>
  new Request("http://local/api/course/course-1/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

describe("SCORM commit handling", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    resetPrismaMocks()
  })

  test("stores suspend_data from commit payload", async () => {
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

    mockPrisma.courseSession.update.mockResolvedValue({
      id: "session-1",
      certificateSent: false,
      status: "InProgress",
      lessonLocation: null,
      score: null,
    } as any)

    mockPrisma.scormData.upsert.mockResolvedValue({} as any)

    const request = buildRequest({
      contentType: "SCORM",
      cmiData: { cmi: { suspend_data: "commit-state-123" } },
    })

    await postCourseState(request, { params: Promise.resolve({ courseId: "course-1" }) })

    expect(mockPrisma.courseSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suspendData: "commit-state-123",
        }),
      })
    )
  })
})

describe("SCORM success trigger", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    resetPrismaMocks()
  })

  test("fires only once for repeated passed updates", async () => {
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
        status: "Passed",
        lessonLocation: null,
        score: 90,
      } as any)
      .mockResolvedValueOnce({
        id: "session-1",
        certificateSent: true,
        status: "Passed",
      } as any)
      .mockResolvedValueOnce({
        id: "session-1",
        certificateSent: true,
        status: "Passed",
        lessonLocation: null,
        score: 90,
      } as any)

    mockPrisma.scormData.upsert.mockResolvedValue({} as any)
    mockPrisma.enrollment.update.mockResolvedValue({} as any)

    const payload = {
      contentType: "SCORM",
      cmiData: { cmi: { success_status: "passed" } },
      score: 90,
    }

    await postCourseState(buildRequest(payload), {
      params: Promise.resolve({ courseId: "course-1" }),
    })
    await postCourseState(buildRequest(payload), {
      params: Promise.resolve({ courseId: "course-1" }),
    })

    expect(mockCertificateService.generateAndEmail).toHaveBeenCalledTimes(1)
  })
})
