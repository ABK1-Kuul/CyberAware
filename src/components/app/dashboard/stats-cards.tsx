import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, CheckCircle, Hourglass, Users } from "lucide-react"

type Stats = {
  totalUsers: number
  totalCourses: number
  completed: number
  inProgress: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const statItems = [
    { title: "Total Learners", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { title: "Total Courses", value: stats.totalCourses, icon: BookOpen, color: "text-purple-400" },
    { title: "Completed", value: stats.completed, icon: CheckCircle, color: "text-green-400" },
    { title: "In Progress", value: stats.inProgress, icon: Hourglass, color: "text-yellow-400" },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
            <item.icon className={`h-5 w-5 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">from last month</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
