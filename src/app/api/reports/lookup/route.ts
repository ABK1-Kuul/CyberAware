import { NextResponse } from "next/server"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { prisma } from "@/lib/prisma"
import { matchGophishCampaignByDomain, normalizeDomain } from "@/services/threat-matcher"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "reports:lookup", limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many lookup requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get("url") ?? ""
  if (!targetUrl.trim()) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 })
  }

  try {
    const gophishMatch = await matchGophishCampaignByDomain(targetUrl)
    if (gophishMatch) {
      return NextResponse.json({
        rating: "SIMULATION",
        campaignId: gophishMatch.campaignId,
      })
    }
  } catch {
    // ignore gophish lookup errors
  }

  const domain = normalizeDomain(targetUrl)
  if (domain) {
    const blocked = await prisma.blockedDomain.findUnique({
      where: { domain },
      select: { id: true, createdAt: true },
    })
    const incidentForDomain = await prisma.incidentGroup.findFirst({
      where: { domain },
      orderBy: { lastReportedAt: "desc" },
      select: { id: true, severity: true, reportCount: true },
    })
    if (blocked) {
      return NextResponse.json({
        rating: "DANGER",
        severity: incidentForDomain?.severity ?? "CRITICAL",
        blocked: true,
        reportCount: incidentForDomain?.reportCount ?? undefined,
      })
    }

    if (incidentForDomain) {
      const recent = new Date().getTime() - 5 * 60 * 1000
      const recentReport = await prisma.reportedItem.findFirst({
        where: {
          incidentGroupId: incidentForDomain.id,
          createdAt: { gte: new Date(recent) },
        },
        select: { id: true },
      })
      return NextResponse.json({
        rating: "DANGER",
        severity: incidentForDomain.severity,
        recent: Boolean(recentReport),
        reportCount: incidentForDomain.reportCount,
      })
    }
  }

  return NextResponse.json({ rating: "UNKNOWN" })
}
