"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart"

type ResponsePoint = {
  label: string
  mttr: number
  mttc: number
}

const chartConfig = {
  mttr: {
    label: "MTTR (Report)",
    color: "hsl(var(--chart-2))",
  },
  mttc: {
    label: "MTTC (Click)",
    color: "hsl(var(--chart-5))",
  },
}

export function HumanResponseWindow({ data }: { data: ResponsePoint[] }) {
  return (
    <Card className="bg-slate-950/40 border-slate-800 shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">Human Response Window</CardTitle>
        <CardDescription>
          Mean time to report vs. mean time to click (lower is better).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickMargin={8}
              allowDecimals={false}
              label={{ value: "Minutes", angle: -90, position: "insideLeft" }}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            <ReferenceLine
              y={15}
              stroke="hsl(var(--chart-3))"
              strokeDasharray="4 4"
              label={{ value: "Target 15m", position: "insideTopRight", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="mttr"
              stroke="var(--color-mttr)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="mttc"
              stroke="var(--color-mttc)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
