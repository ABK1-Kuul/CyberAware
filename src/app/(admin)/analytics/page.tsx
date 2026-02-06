import { SummaryRiskCards } from "@/components/app/analytics/summary-risk-cards"
import { DepartmentalHeatmap } from "@/components/app/analytics/risk-heatmap"
import { GoldenMinuteTracker } from "@/components/app/analytics/golden-minute-tracker"
import { DepartmentLeaderboard } from "@/components/app/analytics/DepartmentLeaderboard"
import { VulnerabilityRankingTable } from "@/components/app/analytics/vulnerability-ranking-table"
import { EnvironmentRisks } from "@/components/app/analytics/environment-risks"
import { ResilienceTrend } from "@/components/app/analytics/resilience-trend"
import {
  getDepartmentalHeatmap,
  getDepartmentLeaderboard,
  getEnvironmentRisks,
  getExecutiveSummary,
  getGoldenMinuteTimeline,
  getHistoricalTrend,
  getTopRiskDepartments,
} from "@/services/analytics"

export default async function AnalyticsPage() {
  const [
    summary,
    heatmap,
    goldenMinute,
    leaderboard,
    topRisk,
    environmentRisks,
    historicalTrend,
  ] = await Promise.all([
    getExecutiveSummary(),
    getDepartmentalHeatmap(),
    getGoldenMinuteTimeline(),
    getDepartmentLeaderboard(),
    getTopRiskDepartments(),
    getEnvironmentRisks(),
    getHistoricalTrend(3),
  ])

  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline">Cyber Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Executive Risk View - traffic light protocol for resiliency, caution, and remediation.
        </p>
      </div>

      <SummaryRiskCards metrics={summary} />

      <ResilienceTrend data={historicalTrend} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DepartmentalHeatmap departments={heatmap} />
        </div>
        <GoldenMinuteTracker data={goldenMinute} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DepartmentLeaderboard departments={leaderboard} />
        </div>
        <EnvironmentRisks data={environmentRisks} />
      </div>

      <VulnerabilityRankingTable departments={topRisk} />
    </div>
  )
}
