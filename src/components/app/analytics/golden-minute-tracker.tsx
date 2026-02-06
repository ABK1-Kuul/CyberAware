"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import type { GoldenMinuteSummary } from "@/services/analytics"

const chartConfig = {
  seconds: {
    label: "Seconds to Report",
    color: "hsl(var(--chart-3))",
  },
}

export function GoldenMinuteTracker({ data }: { data: GoldenMinuteSummary }) {
  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Golden Minute Tracker</CardTitle>
        <CardDescription>
          Seconds between first phish landing and the first report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <LineChart data={data.points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickMargin={8}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{
                stroke: "hsl(var(--border))",
                strokeWidth: 2,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.campaign
                      ? `${payload[0].payload.campaign} (${label})`
                      : label
                  }
                />
              }
            />
            <Line
              type="monotone"
              dataKey="seconds"
              stroke="var(--color-seconds)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
        {data.points.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono">
            No reporting intervals captured yet.
          </p>
        ) : null}
        {data.pending > 0 ? (
          <p className="text-xs text-muted-foreground font-mono">
            {data.pending} campaign(s) awaiting first report.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
