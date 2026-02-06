import { ShieldAlert, ShieldCheck, Siren, UserCog } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ExecutiveSummary } from "@/services/analytics"

function getRiskTone(score: number) {
  if (score >= 70) return { text: "text-red-400", ring: "stroke-red-400", glow: "shadow-red-500/30" }
  if (score <= 30) return { text: "text-emerald-400", ring: "stroke-emerald-400", glow: "shadow-emerald-500/30" }
  return { text: "text-amber-400", ring: "stroke-amber-400", glow: "shadow-amber-500/30" }
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%"
  return `${(value * 100).toFixed(1)}%`
}

function RiskGauge({ value }: { value: number }) {
  const normalized = Math.min(100, Math.max(0, Math.round(value)))
  const radius = 44
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (normalized / 100) * circumference
  const tone = getRiskTone(normalized)

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="rotate-[-90deg]">
        <circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth={stroke}
          className="stroke-slate-800"
          fill="transparent"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${tone.ring} drop-shadow`}
          fill="transparent"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-semibold ${tone.text}`}>{normalized}</span>
        <span className="text-xs text-muted-foreground">Risk Score</span>
      </div>
    </div>
  )
}

export function SummaryRiskCards({ metrics }: { metrics: ExecutiveSummary }) {
  const compromisePercent = formatPercent(metrics.compromiseRate)
  const reportingPercent = formatPercent(metrics.reportingRate)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Organizational Risk Score
          </CardTitle>
          <ShieldAlert className="h-5 w-5 text-rose-400" />
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          <RiskGauge value={metrics.organizationalRiskScore} />
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Compromise Rate
          </CardTitle>
          <Siren className="h-5 w-5 text-amber-400" />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-semibold text-amber-200">{compromisePercent}</div>
          <p className="text-xs text-muted-foreground font-mono">
            {metrics.compromisedUsers} of {metrics.totalUsers} users
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reporting Rate
          </CardTitle>
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-semibold text-emerald-200">{reportingPercent}</div>
          <p className="text-xs text-muted-foreground font-mono">
            {metrics.reportingUsers} of {metrics.totalUsers} users
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Remediation
          </CardTitle>
          <UserCog className="h-5 w-5 text-sky-400" />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-semibold text-sky-200">
            {metrics.activeRemediation.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground font-mono">Oops training assigned</p>
        </CardContent>
      </Card>
    </div>
  )
}
