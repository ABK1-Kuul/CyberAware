"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import type { HistoricalTrendPoint } from "@/services/analytics"

const chartConfig = {
  resilienceScore: {
    label: "Resilience Score",
    color: "hsl(var(--chart-4))",
  },
}

export function ResilienceTrend({ data }: { data: HistoricalTrendPoint[] }) {
  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Resilience Trend</CardTitle>
        <CardDescription>Monthly average resilience score.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickMargin={8}
              allowDecimals={false}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={{
                stroke: "hsl(var(--border))",
                strokeWidth: 2,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  formatter={(value) => [`${value}`, "Resilience Score"]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="resilienceScore"
              stroke="var(--color-resilienceScore)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
        {data.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground font-mono">
            No resilience history captured yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
