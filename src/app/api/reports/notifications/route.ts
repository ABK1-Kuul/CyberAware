import { NextResponse } from "next/server"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "reports:notifications", limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const markRead = searchParams.get("markRead") === "true"

  const now = new Date()
  const [globalNotifications, userNotifications, recentReports, communityImpact] =
    await Promise.all([
      prisma.globalNotification.findMany({
        where: { active: true, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.userNotification.findMany({
        where: { userId: auth.user.id, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.reportedItem.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          targetUrl: true,
          createdAt: true,
          incidentGroup: { select: { severity: true } },
        },
      }),
      prisma.user.count(),
    ])

  if (markRead) {
    await prisma.userNotification.updateMany({
      where: { userId: auth.user.id, isRead: false },
      data: { isRead: true },
    })
  }

  return NextResponse.json({
    globalNotifications,
    userNotifications,
    recentReports,
    communityImpact,
  })
}
