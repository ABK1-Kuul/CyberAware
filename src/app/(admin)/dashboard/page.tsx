import { getDashboardStats, getCompletionData, getRecentActivity } from "@/lib/data"
import { StatsCards } from "@/components/app/dashboard/stats-cards"
import { CompletionChart } from "@/components/app/dashboard/completion-chart"
import { RecentActivityTable } from "@/components/app/dashboard/recent-activity-table"

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const completionData = await getCompletionData()
  const recentActivity = await getRecentActivity()

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
      <StatsCards stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CompletionChart data={completionData} />
        </div>
        <div>
          <RecentActivityTable data={recentActivity} />
        </div>
      </div>
    </div>
  )
}
