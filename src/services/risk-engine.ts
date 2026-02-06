import { prisma } from "@/lib/prisma"

const BASE_RISK_SCORE = 50
const MIN_RISK_SCORE = 0
const MAX_RISK_SCORE = 100

const EVENT_RISK_DELTAS: Array<{
  delta: number
  matches: (normalizedEvent: string) => boolean
}> = [
  { delta: 30, matches: (event) => event.includes("submit") },
  { delta: 15, matches: (event) => event.includes("click") },
  { delta: -10, matches: (event) => event.includes("training") && event.includes("complete") },
  { delta: -20, matches: (event) => event.includes("report") },
]

function clampRiskScore(value: number) {
  return Math.min(MAX_RISK_SCORE, Math.max(MIN_RISK_SCORE, value))
}

function getRiskDelta(eventType: string) {
  const normalized = eventType.trim().toLowerCase()
  for (const rule of EVENT_RISK_DELTAS) {
    if (rule.matches(normalized)) {
      return rule.delta
    }
  }
  return 0
}

function calculateRiskScore(eventTypes: string[]) {
  const delta = eventTypes.reduce((total, eventType) => total + getRiskDelta(eventType), 0)
  return clampRiskScore(BASE_RISK_SCORE + delta)
}

export async function calculateUserRisk(userId: string) {
  const events = await prisma.phishingEvent.findMany({
    where: { userId },
    select: { eventType: true },
  })
  return calculateRiskScore(events.map((event) => event.eventType))
}
