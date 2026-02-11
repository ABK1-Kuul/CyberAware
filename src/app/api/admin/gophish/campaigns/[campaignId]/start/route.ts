import { NextResponse } from "next/server"
import { format } from "date-fns"
import { gophishApi } from "@/services/gophish-api"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

function parseCampaignId(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

function splitNames(value?: string) {
  if (!value) return []
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "admin:gophish:start", limit: 30 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many start requests." },
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
    const source = await gophishApi.getCampaign(id)
    const templateName =
      source.template?.name || process.env.GOPHISH_DEFAULT_TEMPLATE_NAME || ""
    const pageName = source.page?.name || process.env.GOPHISH_DEFAULT_PAGE_NAME || ""
    const smtpName = source.smtp?.name || process.env.GOPHISH_DEFAULT_SMTP_NAME || ""
    const url = source.url || process.env.GOPHISH_DEFAULT_URL || ""
    const mappedGroupNames = source.groups?.map((group) => group.name).filter(Boolean) ?? []
    const fallbackGroupNames = splitNames(process.env.GOPHISH_DEFAULT_GROUP_NAMES)
    const groupNames = mappedGroupNames.length ? mappedGroupNames : fallbackGroupNames

    if (!templateName || !pageName || !smtpName || !url || groupNames.length === 0) {
      return NextResponse.json(
        {
          error:
            "Missing campaign defaults. Ensure template, page, smtp, url, and groups are configured.",
        },
        { status: 400 }
      )
    }

    const started = await gophishApi.startCampaign({
      name: `${source.name} (Restart ${format(new Date(), "yyyy-MM-dd HH:mm")})`,
      url,
      template: { name: templateName },
      page: { name: pageName },
      smtp: { name: smtpName },
      groups: groupNames.map((name) => ({ name })),
    })

    await prisma.auditLog.create({
      data: {
        action: "gophish.campaign.start",
        actorId: auth.user.id,
        complianceStatus: "NIST-Aligned",
        details: {
          campaignId: started.id,
          sourceId: source.id,
          threatScenario: "General Phishing",
          actorIp: auth.clientIp || "0.0.0.0",
        },
      },
    })

    return NextResponse.json({
      message: "Campaign launched.",
      campaign: started,
    })
  } catch (error) {
    logger.error("Failed to start Gophish campaign", { error })
    return NextResponse.json({ error: "Failed to start campaign." }, { status: 502 })
  }
}
