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

function escapeCsv(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value)
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "admin:gophish:export", limit: 30 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many export requests." },
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
    const campaign = await gophishApi.getCampaign(id)
    const rows = [
      ["Email", "Status", "Reported", "First Name", "Last Name", "Position"],
      ...(campaign.results ?? []).map((result) => [
        result.email,
        result.status,
        result.reported ? "true" : "false",
        result.first_name ?? "",
        result.last_name ?? "",
        result.position ?? "",
      ]),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gophish-campaign-${id}-audit.csv"`,
      },
    })
  } catch (error) {
    logger.error("Failed to export Gophish campaign", { error })
    return NextResponse.json({ error: "Failed to export campaign audit report." }, { status: 502 })
  }
}
