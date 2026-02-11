"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"

type SimulationItem = {
  id: string
  targetUrl: string
  createdAt: string | Date
  gophishCampaignId?: string | null
  user?: { id: string; name: string; email: string }
}

type ExternalReport = {
  id: string
  targetUrl: string
  emailSubject?: string | null
  headers?: unknown
  senderIp?: string | null
  returnPath?: string | null
  messageId?: string | null
  status: string
  wasRealThreat?: boolean | null
  remediationTaken?: string | null
  createdAt: string | Date
  user?: { id: string; name: string; email: string }
  incidentGroup?: {
    id: string
    normalizedUrl: string
    domain: string
    severity: string
    vtDetections?: number | null
    reportCount: number
    lastReportedAt: string | Date
  } | null
}

type ThreatIntelDashboardProps = {
  simulations: {
    reportedCount: number
    clickedCount: number
    items: SimulationItem[]
  }
  externalReports: ExternalReport[]
  blockedDomains: Array<{ id: string; domain: string; source?: string | null; createdAt: string | Date }>
}

function formatDate(value: string | Date) {
  const parsed = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(parsed.getTime())) return "—"
  return format(parsed, "MMM d, yyyy p")
}

function formatHeaders(headers: unknown) {
  if (!headers) return "Headers not captured."
  const raw = typeof headers === "string" ? headers : JSON.stringify(headers, null, 2)
  const trimmed = raw.trim()
  return trimmed.length > 5000 ? `${trimmed.slice(0, 5000)}…` : trimmed
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes("verified")) {
    return <Badge className="bg-emerald-500/10 text-emerald-300">Verified</Badge>
  }
  if (normalized.includes("false")) {
    return <Badge className="bg-slate-500/10 text-slate-300">False Positive</Badge>
  }
  if (normalized.includes("archived")) {
    return <Badge className="bg-slate-600/20 text-slate-300">Archived</Badge>
  }
  return <Badge variant="secondary">Pending</Badge>
}

export function ThreatIntelDashboard({
  simulations,
  externalReports,
  blockedDomains,
}: ThreatIntelDashboardProps) {
  const [externalItems, setExternalItems] = useState(externalReports)
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  const sortedExternal = useMemo(() => {
    return [...externalItems].sort((a, b) => {
      const left = new Date(a.createdAt).getTime()
      const right = new Date(b.createdAt).getTime()
      return right - left
    })
  }, [externalItems])

  const setBusy = (id: string, value: boolean) => {
    setPending((prev) => ({ ...prev, [id]: value }))
  }

  const updateReport = async (id: string, payload: Record<string, unknown>) => {
    setBusy(id, true)
    try {
      const response = await fetch(`/api/admin/threat-intel/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error ?? "Update failed.")
      }
      setExternalItems((prev) => prev.map((item) => (item.id === id ? body.report : item)))
      toast({ title: "Threat intel updated", description: "Changes saved." })
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update report.",
        variant: "destructive",
      })
    } finally {
      setBusy(id, false)
    }
  }

  const notifyUser = async (id: string, type: "THANK_YOU" | "VERIFIED_THREAT") => {
    await updateReport(id, { notifyType: type })
  }

  const exportFromApi = (format: "CSV" | "JSON" | "PALO_ALTO" | "FORTINET" | "M365") => {
    const url = `/api/admin/threat-intel/export?format=${format}`
    window.open(url, "_blank")
  }

  const exportDisabled = blockedDomains.length === 0

  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline">Threat Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Differentiator view for simulation wins and real-world alerts.
        </p>
      </div>

      <Tabs defaultValue="simulations">
        <TabsList>
          <TabsTrigger value="simulations">Simulations</TabsTrigger>
          <TabsTrigger value="external">External Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="simulations">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Simulation Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold text-emerald-300">
                  {simulations.reportedCount.toLocaleString()} reported
                </div>
                <div className="text-sm text-muted-foreground">
                  {simulations.clickedCount.toLocaleString()} clicked
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Success Stories</CardTitle>
              </CardHeader>
              <CardContent>
                {simulations.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No simulation reports yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Reported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulations.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="text-sm font-medium">{item.user?.name ?? "Learner"}</div>
                            <div className="text-xs text-muted-foreground">{item.user?.email}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.gophishCampaignId ?? "Gophish Simulation"}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="external">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>External Alerts</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={exportDisabled}>
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportFromApi("CSV")}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFromApi("JSON")}>JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFromApi("PALO_ALTO")}>
                    Palo Alto EDL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFromApi("FORTINET")}>
                    Fortinet CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportFromApi("M365")}>
                    M365 Blocklist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {sortedExternal.length === 0 ? (
                <p className="text-sm text-muted-foreground">No external reports yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Forensic Headers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedExternal.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{report.emailSubject ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{report.targetUrl}</div>
                            <div className="text-xs text-muted-foreground">
                              Reported by {report.user?.name ?? "Learner"} • {formatDate(report.createdAt)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Severity: {report.incidentGroup?.severity ?? "UNKNOWN"}
                              {report.incidentGroup?.vtDetections !== undefined
                                ? ` • VT detections ${report.incidentGroup?.vtDetections ?? 0}`
                                : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Sender IP: {report.senderIp ?? "n/a"} • Return-Path:{" "}
                              {report.returnPath ?? "n/a"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Message-ID: {report.messageId ?? "n/a"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">{statusBadge(report.status)}</TableCell>
                        <TableCell className="align-top">
                          <pre className="max-h-48 overflow-auto rounded-md bg-slate-950/60 p-3 text-xs text-slate-200">
                            {formatHeaders(report.headers)}
                          </pre>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Verified Threat</span>
                              <Switch
                                checked={report.status === "VERIFIED_THREAT" || Boolean(report.wasRealThreat)}
                                onCheckedChange={(checked) =>
                                  updateReport(report.id, {
                                    wasRealThreat: checked,
                                    status: checked ? "VERIFIED_THREAT" : "PENDING",
                                  })
                                }
                                disabled={Boolean(pending[report.id])}
                              />
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => notifyUser(report.id, "THANK_YOU")}
                                disabled={Boolean(pending[report.id])}
                              >
                                Notify User
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => notifyUser(report.id, "VERIFIED_THREAT")}
                                disabled={Boolean(pending[report.id])}
                              >
                                Notify Verified
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  updateReport(report.id, {
                                    status: "FALSE_POSITIVE",
                                    wasRealThreat: false,
                                  })
                                }
                                disabled={Boolean(pending[report.id])}
                              >
                                False Positive
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
