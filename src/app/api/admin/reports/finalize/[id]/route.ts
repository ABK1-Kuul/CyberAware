import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logger } from "@/lib/logger"
import { logApiRequest } from "@/lib/request-logger"
import { finalizeAuditReport } from "@/services/compliance-report"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  logApiRequest(request)

  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const { hash } = await finalizeAuditReport({
      reportId: id,
      actorId: auth.user.id,
      clientIp: auth.clientIp,
    })
    return NextResponse.json({ status: "locked", hash })
  } catch (error) {
    logger.error("Audit report finalize failed", { error })
    return NextResponse.json({ error: "Failed to finalize report." }, { status: 500 })
  }
}
