"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import type { GophishCampaign, GophishCampaignResult } from "@/services/gophish-api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

type CampaignManagementProps = {
  initialCampaigns: GophishCampaign[]
}

type CampaignTotals = {
  total: number
  sent: number
  opened: number
  clicked: number
  submitted: number
  reported: number
}

const POLL_INTERVAL_MS = 15000

function emptyTotals(): CampaignTotals {
  return { total: 0, sent: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 }
}

function normalizeStatus(value?: string) {
  return (value ?? "").toLowerCase()
}

function addTotals(base: CampaignTotals, delta: CampaignTotals): CampaignTotals {
  return {
    total: base.total + delta.total,
    sent: base.sent + delta.sent,
    opened: base.opened + delta.opened,
    clicked: base.clicked + delta.clicked,
    submitted: base.submitted + delta.submitted,
    reported: base.reported + delta.reported,
  }
}

function statusToTotals(result: GophishCampaignResult): CampaignTotals {
  const normalized = normalizeStatus(result.status)
  const hasSubmitted = normalized.includes("submit")
  const hasClicked = normalized.includes("click")
  const hasOpened = normalized.includes("open")
  const hasSent = normalized.includes("sent")
  const hasReported = normalized.includes("report") || result.reported === true

  if (hasSubmitted) {
    return { total: 1, sent: 1, opened: 1, clicked: 1, submitted: 1, reported: 0 }
  }
  if (hasClicked) {
    return { total: 1, sent: 1, opened: 1, clicked: 1, submitted: 0, reported: 0 }
  }
  if (hasOpened) {
    return { total: 1, sent: 1, opened: 1, clicked: 0, submitted: 0, reported: 0 }
  }
  if (hasSent || hasReported) {
    return { total: 1, sent: 1, opened: 0, clicked: 0, submitted: 0, reported: hasReported ? 1 : 0 }
  }
  return { total: 1, sent: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 }
}

function getTotalsFromResults(results?: GophishCampaignResult[]): CampaignTotals {
  if (!results?.length) return emptyTotals()
  return results.reduce((totals, result) => addTotals(totals, statusToTotals(result)), emptyTotals())
}

function getCampaignTotals(campaign: GophishCampaign): CampaignTotals {
  const stats = campaign.stats
  if (stats && typeof stats.total === "number") {
    return {
      total: stats.total,
      sent: stats.sent ?? 0,
      opened: stats.opened ?? 0,
      clicked: stats.clicked ?? 0,
      submitted: stats.submitted ?? stats.submitted_data ?? 0,
      reported: stats.reported ?? stats.email_reported ?? 0,
    }
  }
  return getTotalsFromResults(campaign.results)
}

function formatDate(value?: string) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return format(parsed, "MMM d, yyyy p")
}

function getStatusBadge(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized.includes("complete")) {
    return <Badge variant="secondary" className="bg-green-500/10 text-green-400">Completed</Badge>
  }
  if (normalized.includes("progress")) {
    return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400">In Progress</Badge>
  }
  if (normalized.includes("scheduled")) {
    return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400">Scheduled</Badge>
  }
  return <Badge variant="outline">{status || "Unknown"}</Badge>
}

function StageProgress({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const safeTotal = total > 0 ? total : 1
  const percent = Math.min(100, Math.max(0, (value / safeTotal) * 100))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}/{total}</span>
      </div>
      <Progress value={percent} />
    </div>
  )
}

export function CampaignManagement({ initialCampaigns }: CampaignManagementProps) {
  const [campaigns, setCampaigns] = useState<GophishCampaign[]>(initialCampaigns)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  useEffect(() => {
    setCampaigns(initialCampaigns)
  }, [initialCampaigns])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const left = new Date(a.created_date ?? 0).getTime()
      const right = new Date(b.created_date ?? 0).getTime()
      return right - left
    })
  }, [campaigns])

  const refreshCampaigns = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch("/api/admin/gophish/campaigns", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to refresh campaigns.")
      }
      const payload = (await response.json()) as { campaigns?: GophishCampaign[] }
      setCampaigns(payload.campaigns ?? [])
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Unable to refresh campaigns.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    const timer = setInterval(() => {
      refreshCampaigns()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refreshCampaigns])

  const runAction = async (key: string, action: () => Promise<void>) => {
    setPendingActions((prev) => ({ ...prev, [key]: true }))
    try {
      await action()
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleStop = async (campaignId: number) => {
    await runAction(`stop-${campaignId}`, async () => {
      const response = await fetch(`/api/admin/gophish/campaigns/${campaignId}/stop`, {
        method: "POST",
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to stop campaign.")
      }
      toast({ title: "Campaign stopped", description: body?.message ?? "Campaign marked complete." })
      await refreshCampaigns()
    }).catch((error) => {
      toast({
        title: "Stop failed",
        description: error instanceof Error ? error.message : "Unable to stop campaign.",
        variant: "destructive",
      })
    })
  }

  const handleStart = async (campaignId: number) => {
    await runAction(`start-${campaignId}`, async () => {
      const response = await fetch(`/api/admin/gophish/campaigns/${campaignId}/start`, {
        method: "POST",
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to start campaign.")
      }
      toast({ title: "Campaign started", description: body?.message ?? "Campaign launched." })
      await refreshCampaigns()
    }).catch((error) => {
      toast({
        title: "Start failed",
        description: error instanceof Error ? error.message : "Unable to start campaign.",
        variant: "destructive",
      })
    })
  }

  const isPending = (key: string) => Boolean(pendingActions[key])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-headline">Gophish Campaigns</CardTitle>
          <CardDescription>Manage campaign lifecycle and monitor live exposure.</CardDescription>
        </div>
        <Button variant="outline" onClick={refreshCampaigns} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {sortedCampaigns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No campaigns available yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Live Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCampaigns.map((campaign) => {
                const totals = getCampaignTotals(campaign)
                const totalTargets = totals.total
                const normalizedStatus = normalizeStatus(campaign.status)
                const canStop = !normalizedStatus.includes("complete")
                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">ID {campaign.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>Created {formatDate(campaign.created_date)}</div>
                        <div>Launch {formatDate(campaign.launch_date)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <StageProgress label="Sent" value={totals.sent} total={totalTargets} />
                        <StageProgress label="Opened" value={totals.opened} total={totalTargets} />
                        <StageProgress label="Clicked" value={totals.clicked} total={totalTargets} />
                        <StageProgress label="Compromised" value={totals.submitted} total={totalTargets} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleStart(campaign.id)}
                            disabled={isPending(`start-${campaign.id}`)}
                          >
                            {isPending(`start-${campaign.id}`) ? "Starting..." : "Start Campaign"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStop(campaign.id)}
                            disabled={!canStop || isPending(`stop-${campaign.id}`)}
                          >
                            {isPending(`stop-${campaign.id}`) ? "Stopping..." : "Stop Campaign"}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/api/admin/gophish/campaigns/${campaign.id}/export`,
                              "_blank"
                            )
                          }
                        >
                          Export Audit Report
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
