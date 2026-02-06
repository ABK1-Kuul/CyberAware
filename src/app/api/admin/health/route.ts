import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { certificateService } from "@/services/certificate-service"

export async function GET(request: Request) {
  const auth = await requireUnifiedAuth(request)
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const health = certificateService.getHealthMetrics()
  return NextResponse.json(health)
}
