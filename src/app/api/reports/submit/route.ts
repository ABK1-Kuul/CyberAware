import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { logApiRequest } from "@/lib/request-logger"
import { rateLimit } from "@/lib/rate-limit"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { calculateUserRisk } from "@/services/risk-engine"
import { awardBadge } from "@/services/gamification-service"
import { gophishApi } from "@/services/gophish-api"
import {
  getVirusTotalDetections,
  matchGophishCampaignByDomain,
  matchGophishCampaignByRid,
  normalizeDomain,
  normalizeIncidentUrl,
} from "@/services/threat-matcher"

const FAILURE_EVENT_TYPES = ["Clicked Link", "Submitted Data"]
const REPORT_EVENT_TYPE = "Reported Phish"

const reportSchema = z
  .object({
    targetUrl: z.string().min(1),
    emailSubject: z.string().optional(),
    headers: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    senderIp: z.string().optional(),
    returnPath: z.string().optional(),
    messageId: z.string().optional(),
    emailBody: z.string().optional(),
    includeBody: z.boolean().optional(),
    screenshot: z.string().optional(),
    source: z.string().optional(),
  })
  .passthrough()

function clampRiskScore(value: number) {
  return Math.min(100, Math.max(0, value))
}

function normalizeHeaders(headers: unknown) {
  if (headers === undefined || headers === null) return null
  if (typeof headers === "string") {
    const trimmed = headers.trim()
    return trimmed ? trimmed : null
  }
  if (typeof headers === "object") return headers
  return String(headers)
}

const MAX_BODY_CHARS = 5000
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024

function sanitizeEmailBody(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > MAX_BODY_CHARS ? `${trimmed.slice(0, MAX_BODY_CHARS)}…` : trimmed
}

function parseHeaderFields(headers: unknown) {
  if (!headers) return {}
  const text = typeof headers === "string" ? headers : JSON.stringify(headers)
  const returnPathMatch = text.match(/Return-Path:\s*<?([^>\n]+)>?/i)
  const messageIdMatch = text.match(/Message-ID:\s*<?([^>\n]+)>?/i)
  const senderIpMatch =
    text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/) ?? text.match(/\b[a-f0-9:]{3,}\b/i)
  return {
    returnPath: returnPathMatch?.[1]?.trim(),
    messageId: messageIdMatch?.[1]?.trim(),
    senderIp: senderIpMatch?.[0]?.trim(),
  }
}

async function saveScreenshot(dataUrl?: string | null) {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i)
  if (!match) return null
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : "png"
  const buffer = Buffer.from(match[2], "base64")
  if (buffer.length > MAX_SCREENSHOT_BYTES) {
    logger.warn("Screenshot skipped: payload too large", { bytes: buffer.length })
    return null
  }
  const fileName = `${randomUUID()}.${ext}`
  const fileKey = `report-snapshots/${fileName}`
  const uploadTemplate = (process.env.REPORT_SCREENSHOT_UPLOAD_URL ?? "").trim()
  const publicBase = (process.env.REPORT_SCREENSHOT_PUBLIC_BASE_URL ?? "").trim()

  if (uploadTemplate) {
    const uploadUrl = uploadTemplate.replace("{key}", encodeURIComponent(fileKey))
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": `image/${ext}` },
      body: buffer,
    })
    if (response.ok) {
      if (publicBase) {
        return `${publicBase.replace(/\/$/, "")}/${fileKey}`
      }
      return null
    }
    logger.warn("Screenshot upload failed", { status: response.status })
  }

  const dir = path.join(process.cwd(), "public", "report-snapshots")
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, fileName), buffer)
  return `/report-snapshots/${fileName}`
}

const SEVERITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
}

function deriveSeverity(detections: number) {
  if (detections >= 5) return "CRITICAL"
  if (detections >= 3) return "HIGH"
  if (detections >= 1) return "MEDIUM"
  return "LOW"
}

function pickHigherSeverity(current: string | null | undefined, next: string) {
  const currentRank = current ? SEVERITY_RANK[current] ?? 0 : 0
  const nextRank = SEVERITY_RANK[next] ?? 0
  return nextRank > currentRank ? next : current ?? next
}

function extractRidFromUrl(targetUrl: string) {
  const trimmed = targetUrl.trim()
  if (!trimmed) return null
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    const rid = parsed.searchParams.get("rid")
    return rid && rid.trim() ? rid.trim() : null
  } catch {
    return null
  }
}

function extractRidFromText(text: string) {
  const directMatch = text.match(/(?:[?&]rid=|rid\s*[:=]\s*)([A-Za-z0-9_-]+)/i)
  if (directMatch?.[1]) return directMatch[1]
  const jsonMatch = text.match(/"rid"\s*:\s*\["?([A-Za-z0-9_-]+)"?\]/i)
  if (jsonMatch?.[1]) return jsonMatch[1]
  return null
}

function extractRidFromHeaders(headers: unknown) {
  if (!headers) return null
  const text = typeof headers === "string" ? headers : JSON.stringify(headers)
  return extractRidFromText(text)
}

function extractRid(targetUrl: string, headers: unknown) {
  return extractRidFromUrl(targetUrl) ?? extractRidFromHeaders(headers)
}

async function getRiskSnapshot(userId: string) {
  const profile = await prisma.userRiskProfile.findUnique({
    where: { userId },
    select: {
      riskScore: true,
      reportingStreak: true,
      totalReported: true,
      lastReportedAt: true,
      achievements: true,
    },
  })
  if (profile) return profile
  return {
    riskScore: await calculateUserRisk(userId),
    reportingStreak: 0,
    totalReported: 0,
    lastReportedAt: null,
    achievements: [],
  }
}

function normalizeAchievements(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

async function safeAwardBadge(userId: string, badgeType: Parameters<typeof awardBadge>[1]) {
  try {
    await awardBadge(userId, badgeType)
  } catch (error) {
    logger.error("Badge award failed", { error, userId, badgeType })
  }
}

function getMailerConfig() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !pass || !from) {
    return null
  }
  return { host, port, user, pass, from }
}

async function notifySocTeam(input: {
  reportId: string
  reporterEmail: string
  reporterName: string
  targetUrl: string
  emailSubject?: string | null
  senderIp?: string | null
  returnPath?: string | null
  messageId?: string | null
  headers?: unknown
}) {
  const recipient = process.env.SOC_ALERT_EMAIL
  if (!recipient) return
  const config = getMailerConfig()
  if (!config) {
    logger.warn("SOC alert skipped: SMTP configuration missing.")
    return
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  const headerText =
    typeof input.headers === "string"
      ? input.headers
      : input.headers
        ? JSON.stringify(input.headers, null, 2)
        : "n/a"

  await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject: `External Phish Report ${input.reportId}`,
    text: `Reporter: ${input.reporterName} <${input.reporterEmail}>\nTarget: ${input.targetUrl}\nSubject: ${
      input.emailSubject ?? "n/a"
    }\nSender IP: ${input.senderIp ?? "n/a"}\nReturn-Path: ${
      input.returnPath ?? "n/a"
    }\nMessage-ID: ${input.messageId ?? "n/a"}\n\nHeaders:\n${headerText}`,
  })
}

export async function POST(request: Request) {
  logApiRequest(request)
  const limit = rateLimit(request, { keyPrefix: "reports:submit", limit: 60 })
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

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const parsed = reportSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report payload." }, { status: 400 })
  }

  const {
    targetUrl,
    emailSubject,
    headers,
    senderIp: senderIpPayload,
    returnPath: returnPathPayload,
    messageId: messageIdPayload,
    emailBody,
    includeBody,
    screenshot,
    source,
  } = parsed.data
  const normalizedTargetUrl = targetUrl.trim()
  const rid = extractRid(normalizedTargetUrl, headers)
  const riskSnapshot = await getRiskSnapshot(auth.user.id)

  let campaignMatch = rid ? await matchGophishCampaignByRid(rid) : null
  if (!campaignMatch && normalizedTargetUrl) {
    campaignMatch = await matchGophishCampaignByDomain(normalizedTargetUrl)
  }

  const reportType = rid || campaignMatch ? "SIMULATION" : "EXTERNAL"
  const reportStatus = reportType === "SIMULATION" ? "ARCHIVED" : "PENDING"
  const normalizedHeaders = normalizeHeaders(headers)
  const headerFields = parseHeaderFields(normalizedHeaders)
  const senderIp = senderIpPayload ?? headerFields.senderIp ?? null
  const returnPath = returnPathPayload ?? headerFields.returnPath ?? null
  const messageId = messageIdPayload ?? headerFields.messageId ?? null
  const sanitizedBody = includeBody ? sanitizeEmailBody(emailBody) : null
  const screenshotUrl = await saveScreenshot(screenshot)

  if (messageId) {
    const existingMessage = await prisma.reportedItem.findFirst({
      where: {
        userId: auth.user.id,
        messageId,
      },
      select: { id: true, type: true },
    })
    if (existingMessage) {
      return NextResponse.json({
        type: existingMessage.type,
        message: "Report already received. Thank you for staying vigilant.",
        reportId: existingMessage.id,
        trackingId: existingMessage.id,
        duplicate: true,
      })
    }
  }

  const incidentKey =
    reportType === "EXTERNAL" ? normalizeIncidentUrl(normalizedTargetUrl) : null
  const incidentDomain =
    reportType === "EXTERNAL" ? normalizeDomain(normalizedTargetUrl) : null
  const incidentGroup =
    reportType === "EXTERNAL" && incidentKey && incidentDomain
      ? await prisma.incidentGroup.upsert({
          where: { normalizedUrl: incidentKey },
          update: {
            lastReportedAt: new Date(),
            reportCount: { increment: 1 },
          },
          create: {
            normalizedUrl: incidentKey,
            domain: incidentDomain,
            firstReportedAt: new Date(),
            lastReportedAt: new Date(),
            reportCount: 1,
          },
        })
      : null

  const report = await prisma.reportedItem.create({
    data: {
      userId: auth.user.id,
      type: reportType,
      targetUrl: normalizedTargetUrl,
      emailSubject: emailSubject ?? null,
      headers: normalizedHeaders ?? undefined,
      senderIp,
      returnPath,
      messageId,
      emailBody: sanitizedBody ?? undefined,
      status: reportStatus,
      gophishCampaignId: campaignMatch?.campaignId ?? null,
      incidentGroupId: incidentGroup?.id ?? null,
      riskScoreAtReport: riskSnapshot.riskScore,
      screenshotUrl: screenshotUrl ?? null,
    },
  })

  let reportingStreak = riskSnapshot.reportingStreak ?? 0
  let totalReported = riskSnapshot.totalReported ?? 0
  let duplicateReport = false

  if (reportType === "SIMULATION") {
    if (rid) {
      try {
        await gophishApi.reportResult(rid)
      } catch (error) {
        logger.error("Failed to report GoPhish result", { error, rid })
      }
    }

    if (campaignMatch) {
      await prisma.phishingCampaign.upsert({
        where: { id: campaignMatch.campaignId },
        update: {
          name: campaignMatch.campaignName,
          status: campaignMatch.status,
          targetGroups: campaignMatch.targetGroups,
        },
        create: {
          id: campaignMatch.campaignId,
          name: campaignMatch.campaignName,
          status: campaignMatch.status,
          targetGroups: campaignMatch.targetGroups,
        },
      })
    }

    const occurredAt = new Date()
    if (campaignMatch) {
      const existingReport = await prisma.phishingEvent.findFirst({
        where: {
          campaignId: campaignMatch.campaignId,
          userId: auth.user.id,
          eventType: REPORT_EVENT_TYPE,
        },
        select: { id: true },
      })
      duplicateReport = Boolean(existingReport)
      if (!duplicateReport) {
        await prisma.phishingEvent.create({
          data: {
            campaignId: campaignMatch.campaignId,
            userId: auth.user.id,
            eventType: REPORT_EVENT_TYPE,
            occurredAt,
            details: {
              source: source ?? "extension",
              rid,
              targetUrl: normalizedTargetUrl,
            },
          },
        })
      }
    }

    if (!duplicateReport) {
      let cleanReport = true
      if (campaignMatch) {
        const failure = await prisma.phishingEvent.findFirst({
          where: {
            campaignId: campaignMatch.campaignId,
            userId: auth.user.id,
            eventType: { in: FAILURE_EVENT_TYPES },
          },
          select: { id: true },
        })
        cleanReport = !failure
      }
      reportingStreak = cleanReport ? reportingStreak + 1 : 0
      totalReported += 1

      const baseRiskScore = await calculateUserRisk(auth.user.id)
      const riskScore = clampRiskScore(baseRiskScore - 5)

      await prisma.userRiskProfile.upsert({
        where: { userId: auth.user.id },
        update: {
          riskScore,
          reportingStreak,
          totalReported,
          lastReportedAt: occurredAt,
          lastUpdated: new Date(),
        },
        create: {
          userId: auth.user.id,
          riskScore,
          reportingStreak,
          totalReported,
          lastReportedAt: occurredAt,
          achievements: normalizeAchievements(riskSnapshot.achievements),
        },
      })

      if (cleanReport && reportingStreak === 3) {
        await safeAwardBadge(auth.user.id, "CYBER_HERO")
      }

      if (campaignMatch) {
        const firstEvent = await prisma.phishingEvent.findFirst({
          where: { campaignId: campaignMatch.campaignId },
          orderBy: { occurredAt: "asc" },
          select: { occurredAt: true },
        })
        if (firstEvent) {
          const deltaMs = Math.abs(occurredAt.getTime() - firstEvent.occurredAt.getTime())
          if (deltaMs <= 5 * 60 * 1000) {
            await safeAwardBadge(auth.user.id, "FIRST_RESPONDER")
          }
        }
      }
    }
  } else {
    if (incidentGroup) {
      const vtResult = await getVirusTotalDetections(normalizedTargetUrl)
      if (vtResult) {
        const nextSeverity = deriveSeverity(vtResult.detections)
        const severity = pickHigherSeverity(incidentGroup.severity, nextSeverity)
        await prisma.incidentGroup.update({
          where: { id: incidentGroup.id },
          data: {
            severity,
            vtDetections: vtResult.detections,
            lastReportedAt: new Date(),
          },
        })
      }
    }
    try {
      await notifySocTeam({
        reportId: report.id,
        reporterEmail: auth.user.email,
        reporterName: auth.user.name || "Learner",
        targetUrl: normalizedTargetUrl,
        emailSubject,
        senderIp,
        returnPath,
        messageId,
        headers: normalizedHeaders ?? undefined,
      })
    } catch (error) {
      logger.error("Failed to send SOC alert", { error, reportId: report.id })
    }
  }

  const response =
    reportType === "SIMULATION"
      ? {
          type: "SIMULATION",
          message: "Heroic catch! This was a training drill.",
          reportId: report.id,
          campaignId: campaignMatch?.campaignId ?? null,
          duplicate: duplicateReport,
        }
      : {
          type: "EXTERNAL",
          message: "Reported to Security. Thank you for your vigilance.",
          reportId: report.id,
          trackingId: report.id,
        }

  return NextResponse.json(response)
}
