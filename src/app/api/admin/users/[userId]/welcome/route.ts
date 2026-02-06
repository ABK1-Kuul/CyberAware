import { NextResponse } from "next/server"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { generateWelcomeGuide } from "@/services/onboarding-service"

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "admin:welcome", limit: 60 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
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
    await generateWelcomeGuide(params.userId)
    return NextResponse.json({ message: "Welcome guide sent." })
  } catch (error) {
    logger.error("Failed to resend welcome guide", { error, userId: params.userId })
    return NextResponse.json({ error: "Failed to send welcome guide." }, { status: 500 })
  }
}
