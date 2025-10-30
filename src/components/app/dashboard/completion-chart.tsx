"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"

type CompletionData = {
  date: string
  "Completed": number
  "In Progress": number
}

const chartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-2))",
  },
  inProgress: {
    label: "In Progress",
    color: "hsl(var(--chart-1))",
  },
}

export function CompletionChart({ data }: { data: CompletionData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Learner Activity</CardTitle>
        <CardDescription>Completions and in-progress courses over the last 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{
                stroke: "hsl(var(--border))",
                strokeWidth: 2,
                strokeDasharray: "3 3",
              }}
              content={<ChartTooltipContent />}
            />
            <Legend content={<ChartLegendContent />} />
            <Line
              dataKey="In Progress"
              type="monotone"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="Completed"
              type="monotone"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
