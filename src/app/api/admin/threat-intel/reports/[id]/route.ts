import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { normalizeDomain } from "@/services/threat-matcher"
import { createGlobalNotification } from "@/services/emergency-broadcast"

const updateSchema = z
  .object({
    status: z.enum(["PENDING", "VERIFIED_THREAT", "FALSE_POSITIVE", "ARCHIVED"]).optional(),
    wasRealThreat: z.boolean().nullable().optional(),
    remediationTaken: z.string().optional(),
    notifyType: z.enum(["THANK_YOU", "VERIFIED_THREAT"]).optional(),
  })
  .strict()

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "admin:threat-intel:update", limit: 60 })
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
  const parsed = updateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 })
  }

  try {
    const { id } = await params
    const report = await prisma.reportedItem.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        targetUrl: true,
        incidentGroupId: true,
      },
    })
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.status) data.status = parsed.data.status
    if (parsed.data.wasRealThreat !== undefined) data.wasRealThreat = parsed.data.wasRealThreat
    if (parsed.data.remediationTaken !== undefined) {
      data.remediationTaken = parsed.data.remediationTaken
    }

    if (parsed.data.notifyType === "VERIFIED_THREAT") {
      data.status = "VERIFIED_THREAT"
      data.wasRealThreat = true
    }

    const updated = await prisma.reportedItem.update({
      where: { id },
      data,
    })

    if (parsed.data.notifyType) {
      const message =
        parsed.data.notifyType === "VERIFIED_THREAT"
          ? "Verified Threat: Thank you for reporting this attack."
          : "Thank you for reporting. Your vigilance keeps everyone safe."
      await prisma.userNotification.create({
        data: {
          userId: report.userId,
          message,
        },
      })
      await prisma.activityLog.create({
        data: {
          userId: report.userId,
          action: "threat-intel.notify",
          metadata: {
            reportId: report.id,
            type: parsed.data.notifyType,
          },
        },
      })
    }

    const isVerified =
      updated.status === "VERIFIED_THREAT" || updated.wasRealThreat === true
    if (isVerified) {
      const domain = normalizeDomain(report.targetUrl)
      if (domain) {
        await prisma.blockedDomain.upsert({
          where: { domain },
          update: { updatedAt: new Date() },
          create: {
            domain,
            source: "admin-verified",
            reportId: report.id,
            incidentGroupId: report.incidentGroupId ?? null,
          },
        })
      }
      await createGlobalNotification({
        title: "CRITICAL: Verified Threat Confirmed",
        message: `Security confirmed an active threat. Do not engage with ${domain ?? "the reported domain"}.`,
        severity: "CRITICAL",
        domain: domain ?? undefined,
        reportId: report.id,
      })
    }

    return NextResponse.json({ report: updated })
  } catch (error) {
    logger.error("Threat intel update failed", { error })
    return NextResponse.json({ error: "Failed to update report." }, { status: 500 })
  }
}
