import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { certificateService } from "@/services/certificate-service"
import { calculateUserRisk } from "@/services/risk-engine"
import { awardBadge, notifyDepartmentHeads } from "@/services/gamification-service"

const REPORT_EVENT_TYPE = "Reported Phish"
const FAILURE_EVENT_TYPES = ["Clicked Link", "Submitted Data"]

const webhookPayloadSchema = z
  .object({
    email: z.string().email(),
    event: z.string().optional(),
    eventType: z.string().optional(),
    event_type: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    occurredAt: z.union([z.string(), z.number()]).optional(),
    occurred_at: z.union([z.string(), z.number()]).optional(),
    details: z.unknown().optional(),
    rid: z.string().optional(),
    campaign_id: z.union([z.string(), z.number()]).optional(),
    campaignId: z.union([z.string(), z.number()]).optional(),
    campaign_name: z.string().optional(),
    campaignName: z.string().optional(),
    status: z.string().optional(),
    target_groups: z.union([z.string(), z.array(z.string())]).optional(),
    targetGroups: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough()

type WebhookPayload = z.infer<typeof webhookPayloadSchema>

function verifyWebhookSignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")
  const cleanedSignature = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature
  const signatureBuffer = Buffer.from(cleanedSignature)
  const digestBuffer = Buffer.from(digest)
  if (signatureBuffer.length !== digestBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(signatureBuffer, digestBuffer)
}

function normalizeEventType(rawEventType?: string) {
  const normalized = (rawEventType ?? "").trim().toLowerCase()
  if (!normalized) return "Unknown"
  if (normalized.includes("submit")) return "Submitted Data"
  if (normalized.includes("click")) return "Clicked Link"
  if (normalized.includes("open")) return "Email Opened"
  if (normalized.includes("report")) return "Reported Phish"
  if (normalized.includes("training") && normalized.includes("complete")) {
    return "Completed Training"
  }
  return rawEventType?.trim() || "Unknown"
}

function normalizeTargetGroups(value: WebhookPayload["targetGroups"] | WebhookPayload["target_groups"]) {
  if (!value) return "[]"
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((entry) => String(entry)))
  }
  const trimmed = value.trim()
  if (!trimmed) return "[]"
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return trimmed
  }
  return JSON.stringify(
    trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}

function parseOccurredAt(value: unknown) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === "number") {
    return new Date(value < 1_000_000_000_000 ? value * 1000 : value)
  }
  if (typeof value === "string") {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    }
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

const SAFE_DETAIL_KEYS = new Set([
  "browser",
  "os",
  "ip",
  "ip_address",
  "ipaddress",
  "useragent",
  "user_agent",
  "user-agent",
  "device",
  "platform",
  "country",
  "region",
  "city",
  "timezone",
])

const FORM_DETAIL_KEYS = new Set(["form", "payload", "data", "fields", "submitted", "submission"])

const SENSITIVE_DETAIL_MARKERS = [
  "password",
  "passcode",
  "passwd",
  "secret",
  "token",
  "otp",
  "pin",
  "ssn",
  "social",
  "credit",
  "card",
  "cvv",
  "cvc",
  "iban",
  "account",
  "routing",
  "bank",
  "dob",
  "birth",
  "address",
  "phone",
]

type SubmittedField = {
  field: string
  type: string
  length?: number
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase()
  return SENSITIVE_DETAIL_MARKERS.some((marker) => normalized.includes(marker))
}

function summarizeField(field: string, value: unknown): SubmittedField {
  if (typeof value === "string") {
    return { field, type: "string", length: value.length }
  }
  if (typeof value === "number") {
    return { field, type: "number", length: String(value).length }
  }
  if (typeof value === "boolean") {
    return { field, type: "boolean" }
  }
  if (Array.isArray(value)) {
    return { field, type: "array", length: value.length }
  }
  if (value && typeof value === "object") {
    return { field, type: "object", length: Object.keys(value as Record<string, unknown>).length }
  }
  return { field, type: "unknown" }
}

function summarizeSubmission(fields: SubmittedField[]) {
  if (!fields.length) return "User submitted form data."
  const primary = fields[0]
  if (primary.length !== undefined) {
    return `User submitted a ${primary.length}-character ${primary.field}.`
  }
  return `User submitted ${fields.length} field(s).`
}

function sanitizeDetails(details: unknown, eventType: string) {
  const isSubmission = eventType.toLowerCase().includes("submit")
  let parsed: unknown = details

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown
    } catch {
      parsed = parsed.trim()
    }
  }

  if (parsed === null || parsed === undefined) return null
  if (typeof parsed !== "object") {
    if (!isSubmission) return parsed
    const summary = summarizeField("submission", parsed)
    return {
      redacted: true,
      summary: summarizeSubmission([summary]),
      submittedFields: [summary],
    }
  }

  const safeDetails: Record<string, unknown> = {}
  const submittedFields: SubmittedField[] = []

  const collectFields = (value: unknown, prefix: string) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        submittedFields.push(summarizeField(`${prefix}[${index}]`, entry))
      })
      return
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        submittedFields.push(summarizeField(`${prefix}.${key}`, entry))
      }
      return
    }
    submittedFields.push(summarizeField(prefix, value))
  }

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase()
    if (SAFE_DETAIL_KEYS.has(normalizedKey)) {
      safeDetails[key] = value
      continue
    }
    if (FORM_DETAIL_KEYS.has(normalizedKey) || isSensitiveKey(normalizedKey) || isSubmission) {
      collectFields(value, key)
      continue
    }
    if (!isSubmission) {
      safeDetails[key] = value
    } else {
      collectFields(value, key)
    }
  }

  if (submittedFields.length || isSubmission) {
    safeDetails.submittedFields = submittedFields
    safeDetails.summary = summarizeSubmission(submittedFields)
    safeDetails.redacted = true
  }

  return safeDetails
}

async function resolveDepartment(user: { id: string; team: string; departmentId: string | null }) {
  if (user.departmentId) {
    return prisma.department.findUnique({ where: { id: user.departmentId } })
  }
  const team = user.team?.trim()
  if (!team) return null
  const existing = await prisma.department.findUnique({ where: { name: team } })
  if (existing) return existing
  const totalUsers = await prisma.user.count({ where: { team } })
  return prisma.department.create({
    data: {
      name: team,
      totalUsers,
    },
  })
}

function buildDepartmentUserFilter(department: { id: string; name: string }) {
  return {
    OR: [{ departmentId: department.id }, { team: department.name }],
  }
}

function clampRiskScore(value: number) {
  return Math.min(100, Math.max(0, value))
}

async function safeAwardBadge(userId: string, badgeType: Parameters<typeof awardBadge>[1]) {
  try {
    await awardBadge(userId, badgeType)
  } catch (error) {
    logger.error("Badge award failed", { error, userId, badgeType })
  }
}

export async function POST(request: Request) {
  logApiRequest(request)
  const limit = await rateLimit(request, { keyPrefix: "gophish:webhook", limit: 120 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many webhook requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    )
  }
  try {
    if (!env.GOPHISH_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Gophish webhook secret not configured." },
        { status: 500 }
      )
    }
    const signature = request.headers.get("x-gophish-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing x-gophish-signature header." }, { status: 401 })
    }

    const rawBody = await request.text()
    if (!verifyWebhookSignature(rawBody, signature, env.GOPHISH_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 })
    }
    const payloadResult = webhookPayloadSchema.safeParse(parsedJson)
    if (!payloadResult.success) {
      return NextResponse.json({ error: "Invalid payload: email required." }, { status: 400 })
    }
    const payload = payloadResult.data
    const eventType = normalizeEventType(
      payload.eventType ?? payload.event_type ?? payload.event
    )
    const isReportEvent = eventType === REPORT_EVENT_TYPE
    const occurredAt = parseOccurredAt(payload.occurredAt ?? payload.occurred_at ?? payload.timestamp)
    const details = sanitizeDetails(payload.details, eventType)
    const campaignId = payload.campaignId ?? payload.campaign_id ?? "unknown"
    const campaignIdValue = String(campaignId).trim() || "unknown"
    const campaignName =
      payload.campaignName ?? payload.campaign_name ?? `Campaign ${campaignIdValue}`
    const campaignStatus = payload.status ?? "Active"
    const targetGroups = normalizeTargetGroups(payload.targetGroups ?? payload.target_groups)

    const user = await prisma.user.findFirst({
      where: { email: { equals: payload.email, mode: "insensitive" } },
      select: { id: true, name: true, email: true, team: true, departmentId: true },
    })
    if (!user) {
      logger.warn("GoPhish webhook user not found", {
        email: payload.email,
        campaignId: campaignIdValue,
        eventType,
      })
      return NextResponse.json({ message: "Webhook received: user not found." }, { status: 202 })
    }

    await prisma.phishingCampaign.upsert({
      where: { id: campaignIdValue },
      update: {
        name: campaignName,
        status: campaignStatus,
        targetGroups,
      },
      create: {
        id: campaignIdValue,
        name: campaignName,
        status: campaignStatus,
        targetGroups,
      },
    })

    let duplicateReport = false
    if (isReportEvent) {
      const existingReport = await prisma.phishingEvent.findFirst({
        where: {
          campaignId: campaignIdValue,
          userId: user.id,
          eventType: REPORT_EVENT_TYPE,
        },
        select: { id: true },
      })
      duplicateReport = Boolean(existingReport)
    }

    if (!duplicateReport) {
      await prisma.phishingEvent.create({
        data: {
          campaignId: campaignIdValue,
          userId: user.id,
          eventType,
          occurredAt,
          details,
        },
      })
    } else {
      logger.info("Duplicate report ignored for streak", {
        userId: user.id,
        campaignId: campaignIdValue,
      })
    }

    const existingProfile = await prisma.userRiskProfile.findUnique({
      where: { userId: user.id },
      select: {
        riskScore: true,
        reportingStreak: true,
        totalReported: true,
        lastReportedAt: true,
      },
    })

    let reportingStreak = existingProfile?.reportingStreak ?? 0
    let totalReported = existingProfile?.totalReported ?? 0
    let lastReportedAt = existingProfile?.lastReportedAt ?? null
    let cleanReport = false
    let updatedRiskScore: number | null = null

    if (isReportEvent && !duplicateReport) {
      const failure = await prisma.phishingEvent.findFirst({
        where: {
          campaignId: campaignIdValue,
          userId: user.id,
          eventType: { in: FAILURE_EVENT_TYPES },
        },
        select: { id: true },
      })
      cleanReport = !failure
      reportingStreak = cleanReport ? reportingStreak + 1 : 0
      totalReported += 1
      lastReportedAt = new Date()
    } else if (FAILURE_EVENT_TYPES.includes(eventType)) {
      reportingStreak = 0
    }

    if (!duplicateReport) {
      const baseRiskScore = await calculateUserRisk(user.id)
      const riskScore =
        isReportEvent && !duplicateReport
          ? clampRiskScore(baseRiskScore - 5)
          : baseRiskScore
      updatedRiskScore = riskScore

      await prisma.userRiskProfile.upsert({
        where: { userId: user.id },
        update: {
          riskScore,
          reportingStreak,
          totalReported,
          lastReportedAt,
          lastUpdated: new Date(),
        },
        create: {
          userId: user.id,
          riskScore,
          reportingStreak,
          totalReported,
          lastReportedAt,
          achievements: [],
        },
      })
    }

    if (isReportEvent && !duplicateReport) {
      const firstEvent = await prisma.phishingEvent.findFirst({
        where: { campaignId: campaignIdValue },
        orderBy: { occurredAt: "asc" },
        select: { occurredAt: true },
      })
      if (firstEvent) {
        const deltaMs = Math.abs(occurredAt.getTime() - firstEvent.occurredAt.getTime())
        if (deltaMs <= 5 * 60 * 1000) {
          await safeAwardBadge(user.id, "FIRST_RESPONDER")
        }
      }
      if (cleanReport && reportingStreak === 3) {
        await safeAwardBadge(user.id, "CYBER_HERO")
      }
    }

    if (!duplicateReport) {
      const department = await resolveDepartment(user)
      if (department) {
        const filter = buildDepartmentUserFilter(department)
        const [totalUsers, riskAggregate] = await Promise.all([
          prisma.user.count({ where: filter }),
          prisma.userRiskProfile.aggregate({
            _avg: { riskScore: true },
            where: { user: filter },
          }),
        ])
        await prisma.department.update({
          where: { id: department.id },
          data: {
            riskScore: Math.round(riskAggregate._avg.riskScore ?? 50),
            totalUsers,
            lastSynced: new Date(),
          },
        })

        const updatedRisk = Math.round(riskAggregate._avg.riskScore ?? 50)
        if (updatedRisk <= 10) {
          await notifyDepartmentHeads({
            departmentId: department.id,
            campaignId: campaignIdValue,
            campaignName,
          })
        }
      }
    }

    if (eventType === "Submitted Data") {
      try {
        await certificateService.sendSecurityAlertEmail({
          to: user.email,
          name: user.name || "Learner",
          eventType,
          campaignName,
        })
      } catch (emailError) {
        logger.error("Failed to send security alert email", {
          error: emailError,
          userId: user.id,
          campaignId: campaignIdValue,
        })
      }
    }

    logger.info("GoPhish webhook processed", {
      email: payload.email,
      campaignId: campaignIdValue,
      eventType,
      riskScore: updatedRiskScore,
      rid: payload.rid,
    })

    return NextResponse.json({ message: "Webhook received successfully" }, { status: 200 })
  } catch (error) {
    logger.error("GoPhish webhook error", { error })
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
