import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { formatBlocklist } from "@/services/firewall-export"

const VALID_FORMATS = ["CSV", "JSON", "PALO_ALTO", "FORTINET", "M365"] as const
type ExportFormat = (typeof VALID_FORMATS)[number]

export async function GET(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "admin:threat-intel:export", limit: 30 })
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

  const { searchParams } = new URL(request.url)
  const formatParam = (searchParams.get("format") ?? "PALO_ALTO").toUpperCase()
  if (!VALID_FORMATS.includes(formatParam as ExportFormat)) {
    return NextResponse.json({ error: "Invalid export format." }, { status: 400 })
  }
  const format = formatParam as ExportFormat
  const last24Hours = searchParams.get("last24Hours") === "true"
  const since = last24Hours ? new Date(Date.now() - 24 * 60 * 60 * 1000) : undefined

  const blockedDomains = await prisma.blockedDomain.findMany({
    where: since ? { updatedAt: { gte: since } } : undefined,
    orderBy: { updatedAt: "desc" },
    select: { domain: true, source: true, createdAt: true },
  })

  const output = formatBlocklist(blockedDomains, format)
  const extension =
    format === "PALO_ALTO" ? ".txt" : format === "JSON" ? ".json" : ".csv"
  const fileName = `blocked-domains-${format.toLowerCase()}${
    last24Hours ? "-last-24h" : ""
  }${extension}`
  const contentType =
    format === "PALO_ALTO"
      ? "text/plain"
      : format === "JSON"
        ? "application/json"
        : "text/csv"

  return new Response(output, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
