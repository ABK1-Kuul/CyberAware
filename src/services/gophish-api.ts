import { logger } from "@/lib/logger"

type JsonRecord = Record<string, unknown>

export type GophishTarget = {
  email: string
  first_name?: string
  last_name?: string
  position?: string
}

export type GophishGroup = {
  id: number
  name: string
  targets?: GophishTarget[]
}

type GophishGroupSummary = {
  id: number
  name: string
}

export type GophishEntityRef = {
  id?: number
  name?: string
} & JsonRecord

export type GophishCampaignResult = {
  email: string
  status: string
  reported?: boolean
  first_name?: string
  last_name?: string
  position?: string
}

export type GophishCampaign = {
  id: number
  name: string
  status: string
  created_date?: string
  launch_date?: string
  completed_date?: string
  url?: string
  template?: GophishEntityRef
  page?: GophishEntityRef
  smtp?: GophishEntityRef
  results?: GophishCampaignResult[]
  stats?: {
    total: number
    sent: number
    opened: number
    clicked: number
    submitted?: number
    submitted_data?: number
    reported?: number
    email_reported?: number
  }
  groups?: GophishGroupSummary[]
}

type GophishCampaignCreateBase = {
  name: string
  url: string
  launch_date?: string
  send_by_date?: string
  tracking?: {
    open_tracking?: boolean
    click_tracking?: boolean
  }
} & JsonRecord

type GophishCampaignCreateById = GophishCampaignCreateBase & {
  template_id: number
  page_id: number
  smtp: { id: number }
  groups: Array<{ id: number }>
}

type GophishCampaignCreateByName = GophishCampaignCreateBase & {
  template: { name: string }
  page: { name: string }
  smtp: { name: string }
  groups: Array<{ name: string }>
}

export type GophishCampaignCreate = GophishCampaignCreateById | GophishCampaignCreateByName

type GophishRequestOptions = {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: HeadersInit
}

export type GophishGroupStats = {
  groupId: number
  groupName: string
  totalTargets: number
  campaignCount: number
  totals: GroupTotals
  rates: GroupRates
  campaigns: Array<{
    id: number
    name: string
    status: string
    totals: GroupTotals
    rates: GroupRates
  }>
}

export type VulnerabilityMatrix = {
  generatedAt: string
  metric: "clickRate"
  totalGroups: number
  chart: {
    data: Array<{
      groupId: number
      group: string
      clickRate: number
      clickRateRatio: number
      total: number
      sent: number
      opened: number
      clicked: number
      submitted: number
      reported: number
    }>
    xKey: "group"
    yKey: "clickRate"
    unit: "percent"
  }
  groups: GophishGroupStats[]
}

type GroupTotals = {
  total: number
  sent: number
  opened: number
  clicked: number
  submitted: number
  reported: number
}

type GroupRates = {
  clickRate: number
  openRate: number
  submissionRate: number
  reportRate: number
}

const DEFAULT_TIMEOUT_MS = 15000

function getGophishConfig() {
  const baseUrl = (process.env.GOPHISH_API_URL ?? "").trim().replace(/\/$/, "")
  const apiKey = (process.env.GOPHISH_API_KEY ?? "").trim()
  const timeoutMs =
    Number(process.env.GOPHISH_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Gophish API configuration missing. Set GOPHISH_API_URL and GOPHISH_API_KEY."
    )
  }
  return { baseUrl, apiKey, timeoutMs }
}

function buildUrl(baseUrl: string, path: string, query?: GophishRequestOptions["query"]) {
  const normalizedBase =
    baseUrl.endsWith("/api") && path.startsWith("/api") ? baseUrl.slice(0, -4) : baseUrl
  const url = new URL(path.startsWith("http") ? path : `${normalizedBase}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Gophish API returned non-JSON response: ${text.slice(0, 200)}`)
  }
}

async function gophishRequest<T>(path: string, options: GophishRequestOptions = {}): Promise<T> {
  const { baseUrl, apiKey, timeoutMs } = getGophishConfig()
  const url = buildUrl(baseUrl, path, options.query)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = new Headers(options.headers)
    headers.set("Authorization", apiKey)
    headers.set("Accept", "application/json")

    let body: BodyInit | undefined
    if (options.body !== undefined) {
      if (typeof options.body === "string") {
        body = options.body
      } else {
        body = JSON.stringify(options.body)
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json")
        }
      }
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Gophish API error ${response.status}: ${text || response.statusText}`)
    }

    if (response.status === 204) return undefined as T
    return await parseJsonResponse<T>(response)
  } catch (error) {
    logger.error("Gophish API request failed", { path, error })
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildTargetEmailSet(targets: GophishTarget[]) {
  const set = new Set<string>()
  for (const target of targets) {
    if (target.email) set.add(normalizeEmail(target.email))
  }
  return set
}

function emptyTotals(): GroupTotals {
  return { total: 0, sent: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 }
}

function addTotals(base: GroupTotals, delta: GroupTotals): GroupTotals {
  return {
    total: base.total + delta.total,
    sent: base.sent + delta.sent,
    opened: base.opened + delta.opened,
    clicked: base.clicked + delta.clicked,
    submitted: base.submitted + delta.submitted,
    reported: base.reported + delta.reported,
  }
}

function statusToTotals(status: string | null | undefined, reported?: boolean): GroupTotals {
  const normalized = (status ?? "").toLowerCase()
  const hasSubmitted = normalized.includes("submit")
  const hasClicked = normalized.includes("click")
  const hasOpened = normalized.includes("open")
  const hasSent = normalized.includes("sent")
  const hasReported = normalized.includes("report") || reported === true

  let sent = 0
  let opened = 0
  let clicked = 0
  let submitted = 0

  if (hasSubmitted) {
    submitted = 1
    clicked = 1
    opened = 1
    sent = 1
  } else if (hasClicked) {
    clicked = 1
    opened = 1
    sent = 1
  } else if (hasOpened) {
    opened = 1
    sent = 1
  } else if (hasSent || hasReported) {
    sent = 1
  }

  return {
    total: 1,
    sent,
    opened,
    clicked,
    submitted,
    reported: hasReported ? 1 : 0,
  }
}

function summarizeResults(results: GophishCampaignResult[]): GroupTotals {
  return results.reduce(
    (totals, result) => addTotals(totals, statusToTotals(result.status, result.reported)),
    emptyTotals()
  )
}

function calculateRates(totals: GroupTotals): GroupRates {
  return {
    clickRate: totals.total ? totals.clicked / totals.total : 0,
    openRate: totals.total ? totals.opened / totals.total : 0,
    submissionRate: totals.total ? totals.submitted / totals.total : 0,
    reportRate: totals.sent ? totals.reported / totals.sent : 0,
  }
}

function campaignIncludesGroup(campaign: GophishCampaign, groupId: number, groupName: string) {
  if (campaign.groups?.some((group) => group.id === groupId)) return true
  if (campaign.groups?.some((group) => group.name.toLowerCase() === groupName.toLowerCase())) {
    return true
  }
  return false
}

function computeGroupStats(group: GophishGroup, campaigns: GophishCampaign[]): GophishGroupStats {
  const targets = group.targets ?? []
  const targetEmails = buildTargetEmailSet(targets)
  const campaignSummaries: GophishGroupStats["campaigns"] = []
  let aggregateTotals = emptyTotals()

  for (const campaign of campaigns) {
    const results = campaign.results ?? []
    const groupResults = results.filter((result) =>
      result.email ? targetEmails.has(normalizeEmail(result.email)) : false
    )
    if (!groupResults.length && !campaignIncludesGroup(campaign, group.id, group.name)) {
      continue
    }
    const totals = summarizeResults(groupResults)
    aggregateTotals = addTotals(aggregateTotals, totals)
    campaignSummaries.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totals,
      rates: calculateRates(totals),
    })
  }

  return {
    groupId: group.id,
    groupName: group.name,
    totalTargets: targets.length,
    campaignCount: campaignSummaries.length,
    totals: aggregateTotals,
    rates: calculateRates(aggregateTotals),
    campaigns: campaignSummaries,
  }
}

async function getCampaigns(): Promise<GophishCampaign[]> {
  return gophishRequest<GophishCampaign[]>("/api/campaigns/")
}

async function getCampaign(campaignId: number): Promise<GophishCampaign> {
  return gophishRequest<GophishCampaign>(`/api/campaigns/${campaignId}`)
}

async function getGroups(): Promise<GophishGroup[]> {
  return gophishRequest<GophishGroup[]>("/api/groups/")
}

async function getGroup(groupId: number): Promise<GophishGroup> {
  return gophishRequest<GophishGroup>(`/api/groups/${groupId}`)
}

async function getGroupsWithTargets(): Promise<GophishGroup[]> {
  const groups = await getGroups()
  const missingTargets = groups.filter((group) => !Array.isArray(group.targets))
  if (!missingTargets.length) return groups
  const hydrated = await Promise.all(missingTargets.map((group) => getGroup(group.id)))
  const hydratedById = new Map(hydrated.map((group) => [group.id, group]))
  return groups.map((group) => hydratedById.get(group.id) ?? group)
}

async function createGroup(group: { name: string; targets: GophishTarget[] }): Promise<GophishGroup> {
  return gophishRequest<GophishGroup>("/api/groups/", { method: "POST", body: group })
}

async function updateGroup(
  groupId: number,
  group: { name: string; targets: GophishTarget[] }
): Promise<GophishGroup> {
  return gophishRequest<GophishGroup>(`/api/groups/${groupId}`, { method: "PUT", body: group })
}

async function deleteGroup(groupId: number): Promise<void> {
  await gophishRequest(`/api/groups/${groupId}`, { method: "DELETE" })
}

export const gophishApi = {
  getCampaigns,
  getCampaign,
  startCampaign(config: GophishCampaignCreate): Promise<GophishCampaign> {
    return gophishRequest<GophishCampaign>("/api/campaigns/", {
      method: "POST",
      body: config,
    })
  },
  stopCampaign(id: number): Promise<GophishCampaign> {
    return gophishRequest<GophishCampaign>(`/api/campaigns/${id}/complete`, {
      method: "GET",
    })
  },
  async getGroupStats(groupId: number): Promise<GophishGroupStats> {
    const [group, campaigns] = await Promise.all([getGroup(groupId), getCampaigns()])
    return computeGroupStats(group, campaigns)
  },
  async getVulnerabilityMatrix(): Promise<VulnerabilityMatrix> {
    const [groups, campaigns] = await Promise.all([getGroupsWithTargets(), getCampaigns()])
    const groupStats = groups.map((group) => computeGroupStats(group, campaigns))
    const chartData = groupStats
      .map((stats) => {
        const clickRateRatio = stats.rates.clickRate
        const clickRate = Number((clickRateRatio * 100).toFixed(2))
        return {
          groupId: stats.groupId,
          group: stats.groupName,
          clickRate,
          clickRateRatio,
          total: stats.totals.total,
          sent: stats.totals.sent,
          opened: stats.totals.opened,
          clicked: stats.totals.clicked,
          submitted: stats.totals.submitted,
          reported: stats.totals.reported,
        }
      })
      .sort((a, b) => b.clickRateRatio - a.clickRateRatio)

    return {
      generatedAt: new Date().toISOString(),
      metric: "clickRate",
      totalGroups: groupStats.length,
      chart: {
        data: chartData,
        xKey: "group",
        yKey: "clickRate",
        unit: "percent",
      },
      groups: groupStats,
    }
  },
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
}
