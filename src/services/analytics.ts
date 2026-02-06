import { subDays, format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { DatabaseError } from "@/lib/errors"

const DEFAULT_RISK_SCORE = 50
const COMPROMISE_EVENT = "Submitted Data"
const REPORT_EVENT = "Reported Phish"
const FAILURE_EVENTS = new Set(["Submitted Data", "Clicked Link"])

export type ExecutiveSummary = {
  organizationalRiskScore: number
  compromiseRate: number
  reportingRate: number
  activeRemediation: number
  totalUsers: number
  compromisedUsers: number
  reportingUsers: number
}

export type HeatmapDepartment = {
  name: string
  score: number
  accessWeight: number
  failureRate: number
  totalUsers: number
}

export type GoldenMinutePoint = {
  label: string
  seconds: number
  campaign: string
}

export type GoldenMinuteSummary = {
  points: GoldenMinutePoint[]
  pending: number
}

export type TrendDirection = "up" | "down" | "stable"

export type DepartmentLeaderboardEntry = {
  name: string
  resilienceScore: number
  riskScore: number
  trend: TrendDirection
  reportingRate: number
  winningStreak: boolean
}

export type TopRiskDepartment = {
  name: string
  resilienceScore: number
  riskScore: number
  trend: TrendDirection
  lastFailureAt: Date | null
}

export type EnvironmentRisk = {
  label: string
  count: number
  riskLevel: "high" | "medium"
}

export type EnvironmentRiskSummary = {
  risks: EnvironmentRisk[]
  sampleSize: number
}

export type HistoricalTrendPoint = {
  month: string
  resilienceScore: number
  riskScore: number
}

export type DepartmentGrade = {
  id: string
  name: string
  resilienceScore: number
  grade: "A" | "B" | "C" | "D" | "F"
}

type DepartmentUser = {
  phishingEvents: Array<{ eventType: string }>
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function calculateResilienceScore(riskScore: number) {
  return clamp(100 - riskScore)
}

function getRiskGrade(score: number): DepartmentGrade["grade"] {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  return "F"
}

function calculateAccessWeight(departmentName: string) {
  const normalized = departmentName.toLowerCase()
  if (normalized.includes("guest") || normalized.includes("contractor") || normalized.includes("vendor")) {
    return 1
  }
  if (
    normalized.includes("finance") ||
    normalized.includes("admin") ||
    normalized.includes("executive") ||
    normalized.includes("legal") ||
    normalized.includes("security")
  ) {
    return 5
  }
  if (normalized.includes("it") || normalized.includes("engineering") || normalized.includes("operations")) {
    return 4
  }
  if (normalized.includes("hr") || normalized.includes("people") || normalized.includes("marketing")) {
    return 3
  }
  if (normalized.includes("support") || normalized.includes("customer") || normalized.includes("service")) {
    return 2
  }
  return 3
}

function isFailureEvent(eventType: string) {
  return FAILURE_EVENTS.has(eventType) || /click|submit/i.test(eventType)
}

function calculateFailureRate(users: DepartmentUser[]) {
  if (!users.length) return 0
  const failures = users.filter((user) =>
    user.phishingEvents.some((event) => isFailureEvent(event.eventType))
  )
  return failures.length / users.length
}

function getTrend(resilienceScore: number): TrendDirection {
  if (resilienceScore >= 70) return "up"
  if (resilienceScore <= 40) return "down"
  return "stable"
}

function normalizeLabel(value: string, maxLength = 48) {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`
}

function isOutdatedEnvironment(value: string) {
  const sample = value.toLowerCase()
  return (
    sample.includes("msie") ||
    sample.includes("trident") ||
    sample.includes("windows xp") ||
    sample.includes("windows 7") ||
    sample.includes("windows 8") ||
    sample.includes("android 7") ||
    sample.includes("android 8") ||
    sample.includes("ios 12") ||
    sample.includes("os x 10_") ||
    sample.includes("ubuntu 16")
  )
}

function extractEnvironmentLabel(details: unknown) {
  if (!details) return "Unknown"
  if (typeof details === "string") return normalizeLabel(details, 64)
  if (typeof details !== "object") return "Unknown"
  const record = details as Record<string, unknown>
  const browser =
    (record.browser as string | undefined) ||
    (record.browserName as string | undefined) ||
    (record.browser_name as string | undefined)
  const os = (record.os as string | undefined) || (record.platform as string | undefined)
  const userAgent =
    (record.userAgent as string | undefined) ||
    (record.user_agent as string | undefined) ||
    (record["user-agent"] as string | undefined)

  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  if (os) return os
  if (userAgent) return normalizeLabel(userAgent, 64)
  return "Unknown"
}

function buildDepartmentUserFilter(department: { id: string; name: string }) {
  return {
    OR: [{ departmentId: department.id }, { team: department.name }],
  }
}

export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  try {
    const since = subDays(new Date(), 30)
    const [
      totalUsers,
      compromisedUsers,
      reportingUsers,
      activeRemediation,
      departmentAverage,
      userAverage,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "learner" } }),
      prisma.phishingEvent.findMany({
        where: {
          eventType: COMPROMISE_EVENT,
          occurredAt: { gte: since },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.phishingEvent.findMany({
        where: {
          eventType: REPORT_EVENT,
          occurredAt: { gte: since },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.enrollment.count({
        where: {
          status: { in: ["NotStarted", "InProgress"] },
          course: { title: { contains: "Oops", mode: "insensitive" } },
        },
      }),
      prisma.department.aggregate({ _avg: { riskScore: true } }),
      prisma.userRiskProfile.aggregate({ _avg: { riskScore: true } }),
    ])

    const organizationalRiskScore = Math.round(
      departmentAverage._avg.riskScore ??
        userAverage._avg.riskScore ??
        DEFAULT_RISK_SCORE
    )
    const compromisedCount = compromisedUsers.length
    const reportingCount = reportingUsers.length
    const compromiseRate = totalUsers ? compromisedCount / totalUsers : 0
    const reportingRate = totalUsers ? reportingCount / totalUsers : 0

    return {
      organizationalRiskScore,
      compromiseRate,
      reportingRate,
      activeRemediation,
      totalUsers,
      compromisedUsers: compromisedCount,
      reportingUsers: reportingCount,
    }
  } catch (error) {
    logger.error("Analytics error in getExecutiveSummary", { error })
    throw new DatabaseError("Failed to load executive summary metrics", error)
  }
}

export async function getDepartmentalHeatmap(): Promise<HeatmapDepartment[]> {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { users: true } },
        users: {
          select: {
            riskProfile: { select: { riskScore: true } },
            phishingEvents: {
              orderBy: { occurredAt: "desc" },
              take: 5,
              select: { eventType: true },
            },
          },
        },
      },
    })

    return departments.map((dept) => ({
      name: dept.name,
      score: dept.riskScore,
      accessWeight: calculateAccessWeight(dept.name),
      failureRate: calculateFailureRate(dept.users as DepartmentUser[]),
      totalUsers: dept._count.users,
    }))
  } catch (error) {
    logger.error("Analytics error in getDepartmentalHeatmap", { error })
    throw new DatabaseError("Failed to load departmental heatmap", error)
  }
}

export async function getGoldenMinuteTimeline(): Promise<GoldenMinuteSummary> {
  try {
    const campaigns = await prisma.phishingCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        results: {
          orderBy: { occurredAt: "asc" },
          select: { eventType: true, occurredAt: true },
        },
      },
    })

    const points: GoldenMinutePoint[] = []
    let pending = 0

    for (const campaign of campaigns) {
      const events = campaign.results ?? []
      if (!events.length) continue
      const firstEvent = events[0].occurredAt
      const firstReport = events.find((event) => /report/i.test(event.eventType))
      if (!firstReport) {
        pending += 1
        continue
      }
      const seconds = Math.max(
        0,
        Math.round((firstReport.occurredAt.getTime() - firstEvent.getTime()) / 1000)
      )
      points.push({
        label: format(campaign.createdAt, "MMM dd"),
        seconds,
        campaign: campaign.name,
      })
    }

    return {
      points: points.reverse(),
      pending,
    }
  } catch (error) {
    logger.error("Analytics error in getGoldenMinuteTimeline", { error })
    throw new DatabaseError("Failed to load golden minute timeline", error)
  }
}

export async function getDepartmentLeaderboard(): Promise<DepartmentLeaderboardEntry[]> {
  try {
    const since = subDays(new Date(), 30)
    const departments = await prisma.department.findMany({
      orderBy: { riskScore: "asc" },
      take: 5,
      select: { id: true, name: true, riskScore: true },
    })
    const enriched = await Promise.all(
      departments.map(async (dept) => {
        const filter = buildDepartmentUserFilter(dept)
        const [totalUsers, reportingUsers] = await Promise.all([
          prisma.user.count({ where: filter }),
          prisma.phishingEvent.findMany({
            where: {
              eventType: REPORT_EVENT,
              occurredAt: { gte: since },
              user: filter,
            },
            distinct: ["userId"],
            select: { userId: true },
          }),
        ])
        const resilienceScore = calculateResilienceScore(dept.riskScore)
        const reportingRate = totalUsers ? reportingUsers.length / totalUsers : 0
        return {
          name: dept.name,
          resilienceScore,
          riskScore: dept.riskScore,
          trend: getTrend(resilienceScore),
          reportingRate,
          winningStreak: false,
        }
      })
    )
    const maxRate = Math.max(0, ...enriched.map((dept) => dept.reportingRate))
    return enriched.map((dept) => ({
      ...dept,
      winningStreak: maxRate > 0 && dept.reportingRate === maxRate,
    }))
  } catch (error) {
    logger.error("Analytics error in getDepartmentLeaderboard", { error })
    throw new DatabaseError("Failed to load department leaderboard", error)
  }
}

export async function getDepartmentGrades(): Promise<DepartmentGrade[]> {
  try {
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, riskScore: true },
      orderBy: { name: "asc" },
    })
    return departments.map((dept) => {
      const resilienceScore = calculateResilienceScore(dept.riskScore)
      return {
        id: dept.id,
        name: dept.name,
        resilienceScore,
        grade: getRiskGrade(resilienceScore),
      }
    })
  } catch (error) {
    logger.error("Analytics error in getDepartmentGrades", { error })
    throw new DatabaseError("Failed to load department grades", error)
  }
}

export async function getTopRiskDepartments(): Promise<TopRiskDepartment[]> {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { riskScore: "desc" },
      take: 5,
      include: {
        users: {
          select: {
            phishingEvents: {
              where: { eventType: { in: Array.from(FAILURE_EVENTS) } },
              orderBy: { occurredAt: "desc" },
              take: 1,
              select: { occurredAt: true },
            },
          },
        },
      },
    })

    return departments.map((dept) => {
      const lastFailureAt =
        dept.users
          .map((user) => user.phishingEvents[0]?.occurredAt)
          .filter(Boolean)
          .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0] ?? null
      const resilienceScore = calculateResilienceScore(dept.riskScore)
      return {
        name: dept.name,
        resilienceScore,
        riskScore: dept.riskScore,
        trend: getTrend(resilienceScore),
        lastFailureAt,
      }
    })
  } catch (error) {
    logger.error("Analytics error in getTopRiskDepartments", { error })
    throw new DatabaseError("Failed to load top risk departments", error)
  }
}

export async function getEnvironmentRisks(): Promise<EnvironmentRiskSummary> {
  try {
    const events = await prisma.phishingEvent.findMany({
      where: { eventType: COMPROMISE_EVENT },
      orderBy: { occurredAt: "desc" },
      take: 500,
      select: { details: true },
    })

    const counts = new Map<string, EnvironmentRisk>()
    for (const event of events) {
      const label = extractEnvironmentLabel(event.details)
      const normalized = normalizeLabel(label)
      const riskLevel = isOutdatedEnvironment(normalized) ? "high" : "medium"
      const existing = counts.get(normalized)
      if (existing) {
        existing.count += 1
        if (riskLevel === "high") {
          existing.riskLevel = "high"
        }
      } else {
        counts.set(normalized, { label: normalized, count: 1, riskLevel })
      }
    }

    const risks = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    return {
      risks,
      sampleSize: events.length,
    }
  } catch (error) {
    logger.error("Analytics error in getEnvironmentRisks", { error })
    throw new DatabaseError("Failed to load environment risks", error)
  }
}

export async function getHistoricalTrend(months = 3): Promise<HistoricalTrendPoint[]> {
  try {
    const totalMonths = Math.max(1, Math.round(months))
    const now = new Date()
    const fallbackAverage = await prisma.department.aggregate({ _avg: { riskScore: true } })
    const fallbackRisk = fallbackAverage._avg.riskScore ?? DEFAULT_RISK_SCORE

    const points = await Promise.all(
      Array.from({ length: totalMonths }, (_, index) => {
        const offset = totalMonths - 1 - index
        const monthStart = startOfMonth(subMonths(now, offset))
        const monthEnd = endOfMonth(monthStart)
        return prisma.userRiskProfile
          .aggregate({
            _avg: { riskScore: true },
            where: {
              lastUpdated: {
                gte: monthStart,
                lte: monthEnd,
              },
            },
          })
          .then((result) => {
            const riskScore = Math.round(result._avg.riskScore ?? fallbackRisk)
            return {
              month: format(monthStart, "MMM yyyy"),
              resilienceScore: calculateResilienceScore(riskScore),
              riskScore,
            }
          })
      })
    )

    return points
  } catch (error) {
    logger.error("Analytics error in getHistoricalTrend", { error })
    throw new DatabaseError("Failed to load historical trend", error)
  }
}
