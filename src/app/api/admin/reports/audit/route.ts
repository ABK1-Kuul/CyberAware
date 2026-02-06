import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logger } from "@/lib/logger"
import { logApiRequest } from "@/lib/request-logger"
import { generateQuarterlyAudit } from "@/services/compliance-report"

export async function GET(request: Request) {
  logApiRequest(request)

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId") ?? undefined
    const report = await generateQuarterlyAudit(departmentId || undefined)

    return new Response(report.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${report.fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    logger.error("Audit report export failed", { error })
    return NextResponse.json({ error: "Failed to generate audit report." }, { status: 500 })
  }
}
