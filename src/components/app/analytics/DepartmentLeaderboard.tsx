import { ArrowDownRight, ArrowRight, ArrowUpRight, Flame } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DepartmentLeaderboardEntry } from "@/services/analytics"

function getResilienceTone(score: number) {
  if (score >= 70) return "text-emerald-300"
  if (score <= 40) return "text-red-300"
  return "text-amber-300"
}

function TrendIcon({ trend }: { trend: DepartmentLeaderboardEntry["trend"] }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-emerald-300" />
  if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-300" />
  return <ArrowRight className="h-4 w-4 text-amber-300" />
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function DepartmentLeaderboard({ departments }: { departments: DepartmentLeaderboardEntry[] }) {
  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Department Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments synced yet.</p>
        ) : (
          departments.map((dept, index) => (
            <div
              key={dept.name}
              className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{dept.name}</p>
                    {dept.winningStreak ? (
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-amber-300">
                        <Flame className="h-3 w-3" />
                        Winning Streak
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reporting rate {formatPercent(dept.reportingRate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon trend={dept.trend} />
                <span className={`text-lg font-semibold ${getResilienceTone(dept.resilienceScore)}`}>
                  {dept.resilienceScore}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
