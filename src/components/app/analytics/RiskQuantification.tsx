import { TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type RiskQuantificationProps = {
  totalSuccessfulReports: number
  averageRemediationCost?: number
  currency?: string
  sector?: "finance" | "healthcare" | "public" | "general"
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function getSlidingRate({
  totalReports,
  sector,
  overrideRate,
}: {
  totalReports: number
  sector?: RiskQuantificationProps["sector"]
  overrideRate?: number
}) {
  if (overrideRate && overrideRate > 0) return overrideRate
  const baseRate = sector === "finance" ? 180 : sector === "healthcare" ? 160 : 140
  if (totalReports >= 500) return Math.round(baseRate * 0.75)
  if (totalReports >= 200) return Math.round(baseRate * 0.85)
  if (totalReports >= 50) return baseRate
  return Math.round(baseRate * 1.15)
}

export function RiskQuantification({
  totalSuccessfulReports,
  averageRemediationCost,
  currency = "USD",
  sector = "finance",
}: RiskQuantificationProps) {
  const ratePerReport = getSlidingRate({
    totalReports: totalSuccessfulReports,
    sector,
    overrideRate: averageRemediationCost,
  })
  const valueGenerated = totalSuccessfulReports * ratePerReport
  const formattedValue = formatCurrency(valueGenerated, currency)

  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-300" />
          Financial Risk Exposure (2026 Simulation)
        </CardTitle>
        <CardDescription>Estimated avoided breach cost based on reporting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-4xl font-extrabold tracking-tight text-emerald-200">
          {formattedValue}
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Total ROI = {totalSuccessfulReports.toLocaleString()} safe reports ×{" "}
          {formatCurrency(ratePerReport, currency)}
        </p>
      </CardContent>
    </Card>
  )
}
