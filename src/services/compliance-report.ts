import { createHash } from "crypto"
import { format, subMonths } from "date-fns"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { DatabaseError } from "@/lib/errors"
import { getDepartmentalHeatmap, getHistoricalTrend, getDepartmentGrades } from "@/services/analytics"
import { getDirectoryUsers } from "@/services/ad-sync"
import { renderPdfFromUrl } from "@/services/certificate-service"

const DEFAULT_RISK_SCORE = 50
const REPORT_WINDOW_MONTHS = 3
const REPORT_EVENT = "Reported Phish"
const FAILURE_EVENTS = ["Clicked Link", "Submitted Data"]
const DEFAULT_REMEDIATION_COST =
  Number(process.env.AVERAGE_PHISHING_REMEDIATION_COST ?? 5000) || 5000
const DEFAULT_COMPLIANCE_STATUS =
  (process.env.COMPLIANCE_STATUS ?? "").trim() || "DORA/NIST"
const DEFAULT_ORG_NAME = (process.env.ORG_NAME ?? "").trim() || "Organization"

type DepartmentRow = {
  name: string
  clickRate: number
  trainingCompletionRate: number
  totalUsers: number
  clickUsers: number
  trainingUsers: number
  grade: "A" | "B" | "C" | "D" | "F"
}

type AuditTrailRow = {
  campaignId: string
  campaignName: string
  threatScenario?: string | null
  complianceStatus?: string | null
  startedAt?: Date
  stoppedAt?: Date
  startActorId?: string | null
  stopActorId?: string | null
  startActorIp?: string | null
  stopActorIp?: string | null
}

type HeatmapRow = {
  name: string
  accessWeight: number
  failureRate: number
  riskScore: number
  totalUsers: number
}

export type AuditReportData = {
  reportId: string
  reportDate: string
  periodLabel: string
  title: string
  organizationName: string
  complianceStatus: string
  coveragePercent: number
  coverageTestedUsers: number
  coverageTotalUsers: number
  configurationCompliant: boolean
  configurationCompletionRate: number
  capabilityCurrentSeconds: number
  capabilityPreviousSeconds: number
  capabilityTrend: "improving" | "declining" | "flat" | "insufficient"
  resilienceScore: number
  riskScore: number
  totalSuccessfulReports: number
  averageRemediationCost: number
  avoidedBreachCost: number
  departments: DepartmentRow[]
  heatmap: HeatmapRow[]
  humanFirewall: { averageSeconds: number; count: number; pending: number }
  auditTrail: AuditTrailRow[]
  trend: Array<{ month: string; resilienceScore: number; riskScore: number }>
}

function buildDepartmentUserFilter(department: { id: string; name: string }) {
  return {
    OR: [{ departmentId: department.id }, { team: department.name }],
  }
}

async function getExecutiveResilience(departmentId?: string) {
  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { riskScore: true },
    })
    const riskScore = department?.riskScore ?? DEFAULT_RISK_SCORE
    return {
      riskScore,
      resilienceScore: Math.max(0, 100 - riskScore),
    }
  }

  const [deptAverage, userAverage] = await Promise.all([
    prisma.department.aggregate({ _avg: { riskScore: true } }),
    prisma.userRiskProfile.aggregate({ _avg: { riskScore: true } }),
  ])
  const riskScore = Math.round(
    deptAverage._avg.riskScore ?? userAverage._avg.riskScore ?? DEFAULT_RISK_SCORE
  )
  return {
    riskScore,
    resilienceScore: Math.max(0, 100 - riskScore),
  }
}

async function buildDepartmentBreakdown(
  departments: Array<{ id: string; name: string }>,
  startDate: Date,
  gradeMap: Map<string, DepartmentRow["grade"]>
): Promise<DepartmentRow[]> {
  const rows: DepartmentRow[] = []

  for (const department of departments) {
    const userFilter = buildDepartmentUserFilter(department)
    const [totalUsers, clickUsers, trainingUsers] = await Promise.all([
      prisma.user.count({ where: userFilter }),
      prisma.phishingEvent.findMany({
        where: {
          eventType: { in: FAILURE_EVENTS },
          occurredAt: { gte: startDate },
          user: userFilter,
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.enrollment.findMany({
        where: {
          status: "Completed",
          completedAt: { gte: startDate },
          course: { title: { contains: "Oops", mode: "insensitive" } },
          user: userFilter,
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ])

    const clickUsersCount = clickUsers.length
    const trainingUsersCount = trainingUsers.length
    const clickRate = totalUsers ? clickUsersCount / totalUsers : 0
    const trainingCompletionRate = totalUsers ? trainingUsersCount / totalUsers : 0

    rows.push({
      name: department.name,
      clickRate,
      trainingCompletionRate,
      totalUsers,
      clickUsers: clickUsersCount,
      trainingUsers: trainingUsersCount,
      grade: gradeMap.get(department.id) ?? "F",
    })
  }

  return rows
}

async function getHumanFirewallMetric(startDate: Date, endDate?: Date) {
  const dateFilter = endDate
    ? { gte: startDate, lte: endDate }
    : { gte: startDate }
  const campaigns = await prisma.phishingCampaign.findMany({
    where: { createdAt: dateFilter },
    orderBy: { createdAt: "desc" },
    include: {
      results: {
        orderBy: { occurredAt: "asc" },
        select: { eventType: true, occurredAt: true },
      },
    },
  })

  let totalSeconds = 0
  let count = 0
  let pending = 0

  for (const campaign of campaigns) {
    const events = campaign.results ?? []
    if (!events.length) continue
    const firstEvent = events[0].occurredAt
    const firstReport = events.find((event) =>
      event.eventType.toLowerCase().includes("report")
    )
    if (!firstReport) {
      pending += 1
      continue
    }
    const seconds = Math.max(
      0,
      Math.round((firstReport.occurredAt.getTime() - firstEvent.getTime()) / 1000)
    )
    totalSeconds += seconds
    count += 1
  }

  const averageSeconds = count ? Math.round(totalSeconds / count) : 0
  return { averageSeconds, count, pending }
}

async function getAuditTrail(startDate: Date): Promise<AuditTrailRow[]> {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["gophish.campaign.start", "gophish.campaign.stop"] },
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: "asc" },
  })

  const trail = new Map<string, AuditTrailRow>()

  for (const log of auditLogs) {
    const details = (log.details ?? {}) as Record<string, unknown>
    const campaignId = String(details.campaignId ?? details.id ?? "unknown")
    const campaignName = String(details.name ?? details.campaignName ?? campaignId)
    const actorIp =
      typeof details.actorIp === "string" && details.actorIp.trim()
        ? details.actorIp.trim()
        : null
    const threatScenario =
      typeof details.threatScenario === "string" && details.threatScenario.trim()
        ? details.threatScenario.trim()
        : null

    const existing =
      trail.get(campaignId) ?? {
        campaignId,
        campaignName,
        threatScenario,
        complianceStatus: log.complianceStatus ?? null,
      }

    if (log.action === "gophish.campaign.start") {
      existing.startedAt = log.createdAt
      existing.startActorId = log.actorId
      existing.startActorIp = actorIp ?? existing.startActorIp
      existing.threatScenario = threatScenario ?? existing.threatScenario
      existing.complianceStatus = log.complianceStatus ?? existing.complianceStatus
    }
    if (log.action === "gophish.campaign.stop") {
      existing.stoppedAt = log.createdAt
      existing.stopActorId = log.actorId
      existing.stopActorIp = actorIp ?? existing.stopActorIp
      existing.threatScenario = threatScenario ?? existing.threatScenario
      existing.complianceStatus = log.complianceStatus ?? existing.complianceStatus
    }

    trail.set(campaignId, existing)
  }

  return Array.from(trail.values())
}

function normalizeReportId(reportId?: string) {
  const normalized = (reportId ?? "").trim().toLowerCase()
  if (!normalized || normalized === "organization" || normalized === "org") {
    return "organization"
  }
  return reportId ?? "organization"
}

function getAppBaseUrl() {
  const configured = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "")
  return configured || "http://localhost:3000"
}

function buildPreviewUrl(reportId: string) {
  return `${getAppBaseUrl()}/reports/preview/${encodeURIComponent(reportId)}`
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-_]/g, "")
    .toLowerCase()
}

export async function getAuditReportData(reportId?: string): Promise<AuditReportData> {
  const normalizedId = normalizeReportId(reportId)
  try {
    const now = new Date()
    const startDate = subMonths(now, REPORT_WINDOW_MONTHS)
    const periodLabel = `${format(startDate, "MMM dd, yyyy")} - ${format(now, "MMM dd, yyyy")}`

    const departmentFilter = normalizedId !== "organization" ? { id: normalizedId } : undefined
    const departments = await prisma.department.findMany({
      where: departmentFilter,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    if (normalizedId !== "organization" && !departments.length) {
      throw new Error("Department not found for audit report.")
    }

    const departmentScope = normalizedId !== "organization" ? departments[0] : undefined
    const { resilienceScore, riskScore } = await getExecutiveResilience(
      departmentScope?.id
    )
    const departmentGrades = await getDepartmentGrades()
    const gradeMap = new Map(departmentGrades.map((dept) => [dept.id, dept.grade]))
    const departmentRows = await buildDepartmentBreakdown(departments, startDate, gradeMap)
    const previousStart = subMonths(startDate, REPORT_WINDOW_MONTHS)
    const humanFirewall = await getHumanFirewallMetric(startDate, now)
    const previousHumanFirewall = await getHumanFirewallMetric(previousStart, startDate)
    const auditTrail = await getAuditTrail(startDate)
    const heatmap = await getDepartmentalHeatmap().then((rows) => {
      const filtered =
        normalizedId !== "organization"
          ? rows.filter((row) => row.name === departmentScope?.name)
          : rows
      return filtered.map((row) => ({
        name: row.name,
        accessWeight: row.accessWeight,
        failureRate: row.failureRate,
        riskScore: row.score,
        totalUsers: row.totalUsers,
      }))
    })

    const reportFilter =
      departmentScope && departmentScope.id
        ? { user: buildDepartmentUserFilter(departmentScope) }
        : {}
    const successfulReports = await prisma.phishingEvent.findMany({
      where: {
        eventType: REPORT_EVENT,
        occurredAt: { gte: startDate },
        ...reportFilter,
      },
      distinct: ["userId"],
      select: { userId: true },
    })

    const totalSuccessfulReports = successfulReports.length
    const averageRemediationCost = DEFAULT_REMEDIATION_COST
    const avoidedBreachCost = totalSuccessfulReports * averageRemediationCost
    const trend = await getHistoricalTrend(REPORT_WINDOW_MONTHS)

    let directoryUsersCount = 0
    try {
      const directoryUsers = await getDirectoryUsers()
      if (departmentScope?.name) {
        const normalized = departmentScope.name.trim().toLowerCase()
        directoryUsersCount = directoryUsers.filter(
          (user) => (user.department ?? "").trim().toLowerCase() === normalized
        ).length
      } else {
        directoryUsersCount = directoryUsers.length
      }
    } catch (error) {
      logger.warn("Falling back to database user count for coverage metric", { error })
    }

    if (!directoryUsersCount) {
      directoryUsersCount = await prisma.user.count({
        where: departmentScope ? buildDepartmentUserFilter(departmentScope) : undefined,
      })
    }

    const simulatedUsers = await prisma.phishingEvent.findMany({
      where: {
        occurredAt: { gte: startDate },
        ...reportFilter,
      },
      distinct: ["userId"],
      select: { userId: true },
    })
    const coverageTestedUsers = simulatedUsers.length
    const coverageTotalUsers = directoryUsersCount
    const coveragePercent = coverageTotalUsers
      ? coverageTestedUsers / coverageTotalUsers
      : 0

    const doraCourseId = (process.env.DORA_ARTICLE_13_COURSE_ID ?? "").trim()
    const doraCourseTitle =
      (process.env.DORA_ARTICLE_13_COURSE_TITLE ?? "DORA Article 13").trim()
    const doraCourse = doraCourseId
      ? await prisma.course.findUnique({ where: { id: doraCourseId } })
      : await prisma.course.findFirst({
          where: { title: { contains: doraCourseTitle, mode: "insensitive" } },
        })

    let configurationCompliant = false
    let configurationCompletionRate = 0
    if (doraCourse) {
      const [totalEnrollments, completedEnrollments] = await Promise.all([
        prisma.enrollment.count({
          where: {
            courseId: doraCourse.id,
            ...(departmentScope ? { user: buildDepartmentUserFilter(departmentScope) } : {}),
          },
        }),
        prisma.enrollment.count({
          where: {
            courseId: doraCourse.id,
            status: "Completed",
            ...(departmentScope ? { user: buildDepartmentUserFilter(departmentScope) } : {}),
          },
        }),
      ])
      configurationCompletionRate = totalEnrollments
        ? completedEnrollments / totalEnrollments
        : 0
      configurationCompliant =
        totalEnrollments > 0 && completedEnrollments === totalEnrollments
    }

    const capabilityCurrentSeconds = humanFirewall.averageSeconds
    const capabilityPreviousSeconds = previousHumanFirewall.averageSeconds
    const capabilityTrend =
      previousHumanFirewall.count === 0
        ? "insufficient"
        : capabilityCurrentSeconds === capabilityPreviousSeconds
          ? "flat"
          : capabilityCurrentSeconds < capabilityPreviousSeconds
            ? "improving"
            : "declining"

    const title =
      normalizedId !== "organization" && departmentScope
        ? `Executive Audit Report - ${departmentScope.name}`
        : "Executive Audit Report - Organization"

    return {
      reportId: normalizedId,
      reportDate: now.toISOString(),
      periodLabel,
      title,
      organizationName: DEFAULT_ORG_NAME,
      complianceStatus: DEFAULT_COMPLIANCE_STATUS,
      coveragePercent,
      coverageTestedUsers,
      coverageTotalUsers,
      configurationCompliant,
      configurationCompletionRate,
      capabilityCurrentSeconds,
      capabilityPreviousSeconds,
      capabilityTrend,
      resilienceScore,
      riskScore,
      totalSuccessfulReports,
      averageRemediationCost,
      avoidedBreachCost,
      departments: departmentRows,
      heatmap,
      humanFirewall,
      auditTrail,
      trend,
    }
  } catch (error) {
    logger.error("Compliance report data build failed", { error })
    throw new DatabaseError("Failed to build audit report data", error)
  }
}

export async function generateQuarterlyAudit(departmentId?: string) {
  try {
    const normalizedId = normalizeReportId(departmentId)
    const now = new Date()
    if (normalizedId !== "organization") {
      const exists = await prisma.department.findUnique({
        where: { id: normalizedId },
        select: { name: true },
      })
      if (!exists) {
        throw new Error("Department not found for audit report.")
      }
    }

    const previewUrl = buildPreviewUrl(normalizedId)
    const pdfBuffer = await renderPdfFromUrl(previewUrl, {
      format: "A4",
      landscape: false,
      waitUntil: "networkidle0",
    })

    const fileName = `audit-report-${sanitizeFilename(
      normalizedId
    )}-${format(now, "yyyy-MM-dd")}.pdf`

    return { buffer: pdfBuffer, fileName }
  } catch (error) {
    logger.error("Compliance report generation failed", { error })
    throw new DatabaseError("Failed to generate quarterly audit report", error)
  }
}

export async function finalizeAuditReport(options?: {
  reportId?: string
  actorId?: string | null
  clientIp?: string | null
}) {
  const reportId = normalizeReportId(options?.reportId)
  const reportData = await getAuditReportData(reportId)
  const hash = createHash("sha256")
    .update(JSON.stringify(reportData))
    .digest("hex")

  await prisma.auditLog.create({
    data: {
      actorId: options?.actorId ?? null,
      action: "audit.report.finalized",
      complianceStatus: reportData.complianceStatus,
      details: {
        reportId: reportData.reportId,
        periodLabel: reportData.periodLabel,
        hash,
        clientIp: options?.clientIp ?? null,
      },
    },
  })

  return { hash, reportData }
}
