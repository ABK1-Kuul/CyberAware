import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { createGlobalNotification } from "@/services/emergency-broadcast"

const schema = z.object({
  title: z.string().min(3),
  message: z.string().min(3),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  expiresAt: z.string().datetime().optional(),
})

export async function POST(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "admin:threat-intel:broadcast", limit: 30 })
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

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid broadcast payload." }, { status: 400 })
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined
  const notification = await createGlobalNotification({
    title: parsed.data.title,
    message: parsed.data.message,
    severity: parsed.data.severity ?? "WARNING",
    expiresAt,
  })

  return NextResponse.json({ notification })
}
