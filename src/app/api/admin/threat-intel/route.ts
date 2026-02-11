import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "admin:threat-intel:get", limit: 60 })
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
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const [reportedCount, clickedCount, simulations, externalReports] = await Promise.all([
      prisma.phishingEvent.count({ where: { eventType: "Reported Phish" } }),
      prisma.phishingEvent.count({ where: { eventType: "Clicked Link" } }),
      prisma.reportedItem.findMany({
        where: { type: "SIMULATION" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.reportedItem.findMany({
        where: { type: "EXTERNAL" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
          incidentGroup: {
            select: {
              id: true,
              normalizedUrl: true,
              domain: true,
              severity: true,
              vtDetections: true,
              reportCount: true,
              lastReportedAt: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      simulations: {
        reportedCount,
        clickedCount,
        items: simulations,
      },
      externalReports,
    })
  } catch (error) {
    logger.error("Threat intel fetch failed", { error })
    return NextResponse.json({ error: "Failed to fetch threat intel data." }, { status: 500 })
  }
}
