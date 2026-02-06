import { getDashboardStats, getCompletionData, getRecentActivity } from "@/lib/data"
import { StatsCards } from "@/components/app/dashboard/stats-cards"
import { CompletionChart } from "@/components/app/dashboard/completion-chart"
import { RecentActivityTable } from "@/components/app/dashboard/recent-activity-table"
import { CampaignManagement } from "@/components/app/dashboard/campaign-management"
import { gophishApi } from "@/services/gophish-api"
import { logger } from "@/lib/logger"

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const completionData = await getCompletionData()
  const recentActivity = await getRecentActivity()
  let campaigns = []
  try {
    campaigns = await gophishApi.getCampaigns()
  } catch (error) {
    logger.warn("Failed to load Gophish campaigns", { error })
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
      <StatsCards stats={stats} />
      <CampaignManagement initialCampaigns={campaigns} />
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
