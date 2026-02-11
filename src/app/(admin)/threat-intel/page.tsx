import { prisma } from "@/lib/prisma"
import { ThreatIntelDashboard } from "@/components/app/threat-intel/threat-intel-dashboard"

export default async function ThreatIntelPage() {
  const [reportedCount, clickedCount, simulations, externalReports] = await Promise.all([
    prisma.phishingEvent.count({ where: { eventType: "Reported Phish" } }),
    prisma.phishingEvent.count({ where: { eventType: "Clicked Link" } }),
    prisma.reportedItem.findMany({
      where: { type: "SIMULATION" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.reportedItem.findMany({
      where: { type: "EXTERNAL" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        incidentGroup: {
          select: {
            id: true,
            normalizedUrl: true,
            domain: true,
            severity: true,
            vtDetections: true,
            reportCount: true,
            lastReportedAt: true,
          },
        },
      },
    }),
  ])

  return (
    <ThreatIntelDashboard
      simulations={{
        reportedCount,
        clickedCount,
        items: simulations,
      }}
      externalReports={externalReports}
    />
  )
}
