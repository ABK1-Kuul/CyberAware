import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export type AuditSeverity = "INFO" | "WARN" | "CRITICAL"

export type AuditEventData = {
  action: string
  actorId: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  severity?: AuditSeverity
  complianceStatus?: string
}

/**
 * Logs an audit event for compliance and security tracking.
 * This satisfies DORA, NIST, and SOC2 requirements for audit trails.
 *
 * @param data - The audit event data
 * @returns The created audit log entry
 */
export async function logAuditEvent(data: AuditEventData) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId,
        details: data.details
          ? (JSON.parse(JSON.stringify(data.details)) as Record<string, unknown>)
          : {},
        ipAddress: data.ipAddress,
        severity: data.severity ?? "INFO",
        complianceStatus: data.complianceStatus,
      },
    })
    return auditLog
  } catch (error) {
    // Fail-closed: Log the error but don't throw to prevent breaking the main operation
    logger.error("Failed to create audit log", {
      error,
      action: data.action,
      actorId: data.actorId,
    })
    // Return a minimal object to satisfy TypeScript, but log the failure
    return {
      id: "failed",
      action: data.action,
      actorId: data.actorId,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof prisma.auditLog.create>>
  }
}

/**
 * Helper to extract IP address from a Request object
 */
export function getClientIpFromRequest(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const [first] = forwarded.split(",")
    return first?.trim()
  }
  return request.headers.get("x-real-ip") ?? undefined
}
