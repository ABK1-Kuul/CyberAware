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

  const gophishMatch = await matchGophishCampaignByDomain(targetUrl)
  if (gophishMatch) {
    return NextResponse.json({
      rating: "SIMULATION",
      campaignId: gophishMatch.campaignId,
    })
  }

  const domain = normalizeDomain(targetUrl)
  if (domain) {
    const incident = await prisma.incidentGroup.findFirst({
      where: { domain },
      orderBy: { lastReportedAt: "desc" },
      select: { id: true, severity: true },
    })
    if (incident) {
      return NextResponse.json({ rating: "DANGER", severity: incident.severity })
    }
  }

  return NextResponse.json({ rating: "UNKNOWN" })
}
