import { NextResponse } from "next/server"
import { gophishApi } from "@/services/gophish-api"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

function parseCampaignId(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "admin:gophish:stop", limit: 60 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many stop requests." },
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

  const { campaignId } = await params
  const id = parseCampaignId(campaignId)
  if (!id) {
    return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 })
  }

  try {
    await gophishApi.stopCampaign(id)
    return NextResponse.json({ message: "Campaign marked complete." })
  } catch (error) {
    logger.error("Failed to stop Gophish campaign", { error })
    return NextResponse.json({ error: "Failed to stop campaign." }, { status: 502 })
  }
}
