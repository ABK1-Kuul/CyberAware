import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EnvironmentRiskSummary } from "@/services/analytics"

function getRiskTone(level: "high" | "medium") {
  if (level === "high") {
    return {
      text: "text-red-300",
      bar: "bg-red-500/60",
      label: "High Risk",
    }
  }
  return {
    text: "text-amber-300",
    bar: "bg-amber-500/60",
    label: "Elevated",
  }
}

export function EnvironmentRisks({ data }: { data: EnvironmentRiskSummary }) {
  const maxCount = Math.max(1, ...data.risks.map((risk) => risk.count))

  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Environmental Risks
        </CardTitle>
        <CardDescription>
          Top outdated user agents among recent compromises.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.risks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-risk user agents detected.</p>
        ) : (
          data.risks.map((risk) => {
            const tone = getRiskTone(risk.riskLevel)
            return (
              <div key={risk.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-200">{risk.label}</span>
                  <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800/70">
                  <div
                    className={`h-2 rounded-full ${tone.bar}`}
                    style={{ width: `${(risk.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Sample size: {data.sampleSize}
        </p>
      </CardContent>
    </Card>
  )
}
