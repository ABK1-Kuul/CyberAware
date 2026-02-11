import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

type BroadcastSeverity = "INFO" | "WARNING" | "CRITICAL"

type BroadcastInput = {
  title: string
  message: string
  severity?: BroadcastSeverity
  expiresAt?: Date
  reason?: string
  domain?: string
  reportId?: string
}

const DEFAULT_EXPIRY_HOURS = 24

function defaultExpiry() {
  return new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000)
}

async function sendWebhook(payload: {
  title: string
  message: string
  severity: string
  domain?: string
  reason?: string
}) {
  const webhookUrl = (process.env.SECURITY_ALERT_WEBHOOK_URL ?? "").trim()
  if (!webhookUrl) return
  const body = {
    text: `[${payload.severity}] ${payload.title} - ${payload.message}`,
    title: payload.title,
    severity: payload.severity,
    domain: payload.domain,
    reason: payload.reason,
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      logger.warn("Security webhook failed", { status: response.status })
    }
  } catch (error) {
    logger.error("Security webhook failed", { error })
  }
}

export async function createGlobalNotification(input: BroadcastInput) {
  const severity = input.severity ?? "WARNING"
  const expiresAt = input.expiresAt ?? defaultExpiry()

  const notification = await prisma.globalNotification.create({
    data: {
      title: input.title,
      message: input.message,
      severity,
      active: true,
      expiresAt,
    },
  })

  await sendWebhook({
    title: input.title,
    message: input.message,
    severity,
    domain: input.domain,
    reason: input.reason,
  })

  return notification
}

export async function triggerThresholdBroadcast(input: {
  incidentGroupId: string
  domain: string
  reportId?: string
  threshold?: number
}) {
  const threshold = input.threshold ?? 3
  const distinctUsers = await prisma.reportedItem.findMany({
    where: {
      incidentGroupId: input.incidentGroupId,
      type: "EXTERNAL",
    },
    select: { userId: true },
  })
  const uniqueUsers = new Set(distinctUsers.map((entry) => entry.userId)).size
  if (uniqueUsers < threshold) return null

  const existing = await prisma.globalNotification.findFirst({
    where: {
      active: true,
      expiresAt: { gt: new Date() },
      message: { contains: input.domain },
    },
    select: { id: true },
  })
  if (existing) return null

  return createGlobalNotification({
    title: "Global Alert: Suspicious Domain Detected",
    message: `Multiple reports received for ${input.domain}. Treat as active threat.`,
    severity: "CRITICAL",
    reason: `threshold-${threshold}`,
    domain: input.domain,
    reportId: input.reportId,
  })
}
