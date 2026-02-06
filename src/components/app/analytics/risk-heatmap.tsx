import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { HeatmapDepartment } from "@/services/analytics"

type HeatmapCell = {
  impact: number
  probability: number
  departments: string[]
}

function clamp(value: number, min = 1, max = 5) {
  return Math.min(max, Math.max(min, value))
}

function getCellTone(impact: number, probability: number) {
  const severity = impact * probability
  if (severity >= 16) {
    return {
      bg: "bg-red-500/20",
      ring: "ring-1 ring-red-400/40",
      dot: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]",
      text: "text-red-200",
    }
  }
  if (severity >= 9) {
    return {
      bg: "bg-amber-500/20",
      ring: "ring-1 ring-amber-400/40",
      dot: "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
      text: "text-amber-200",
    }
  }
  return {
    bg: "bg-emerald-500/10",
    ring: "ring-1 ring-emerald-400/30",
    dot: "bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    text: "text-emerald-200",
  }
}

function buildMatrix(departments: HeatmapDepartment[]) {
  const grid: HeatmapCell[][] = Array.from({ length: 5 }, (_, rowIndex) =>
    Array.from({ length: 5 }, (_, colIndex) => ({
      impact: colIndex + 1,
      probability: 5 - rowIndex,
      departments: [],
    }))
  )

  for (const dept of departments) {
    const impact = clamp(dept.accessWeight)
    const probability = clamp(Math.ceil(dept.failureRate * 5) || 1)
    const row = 5 - probability
    const col = impact - 1
    grid[row][col].departments.push(dept.name)
  }

  return grid
}

export function DepartmentalHeatmap({ departments }: { departments: HeatmapDepartment[] }) {
  const grid = buildMatrix(departments)

  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Departmental Vulnerability Heatmap</CardTitle>
        <CardDescription>
          Impact vs. probability. Traffic Light Protocol highlights resilience and remediation
          urgency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[auto,1fr] gap-4">
          <div className="flex flex-col justify-between text-xs text-muted-foreground">
            <span className="uppercase tracking-[0.2em] text-[10px]">High</span>
            <span className="uppercase tracking-[0.2em] text-[10px]">Low</span>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2">
              {grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const tone = getCellTone(cell.impact, cell.probability)
                  const count = cell.departments.length
                  const tooltip =
                    cell.departments.length > 0 ? cell.departments.join(", ") : "No departments"
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      title={tooltip}
                      className={`flex h-16 flex-col items-center justify-center rounded-md ${tone.bg} ${tone.ring}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      <span className={`mt-1 text-xs font-mono ${tone.text}`}>
                        {count.toString().padStart(2, "0")}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-[0.2em] text-[10px]">Low Access</span>
              <span className="uppercase tracking-[0.2em] text-[10px]">High Access</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            Resilient
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            Caution
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />
            Immediate remediation
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
