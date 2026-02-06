import { NextResponse } from "next/server"
import { gophishApi } from "@/services/gophish-api"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "admin:gophish:campaigns", limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many campaign requests." },
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
    const campaigns = await gophishApi.getCampaigns()
    return NextResponse.json({ campaigns })
  } catch (error) {
    logger.error("Failed to fetch Gophish campaigns", { error })
    return NextResponse.json(
      { error: "Failed to fetch campaigns from Gophish." },
      { status: 502 }
    )
  }
}
