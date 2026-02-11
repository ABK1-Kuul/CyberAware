import { logger } from "@/lib/logger"
import { gophishApi, type GophishCampaign } from "@/services/gophish-api"

export type GophishCampaignMatch = {
  campaignId: string
  campaignName: string
  status: string
  targetGroups: string
  landingUrl?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
let cachedAt = 0
let cachedCampaigns: GophishCampaign[] | null = null
let inflight: Promise<GophishCampaign[]> | null = null

export function normalizeDomain(input?: string | null) {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    return parsed.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

export function normalizeIncidentUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase()
    const path = parsed.pathname.replace(/\/+$/, "")
    return `${host}${path || "/"}`
  } catch {
    return null
  }
}

function buildVirusTotalUrlId(targetUrl: string) {
  return Buffer.from(targetUrl).toString("base64").replace(/=+$/g, "")
}

export async function getVirusTotalDetections(targetUrl: string) {
  const apiKey = (process.env.VIRUSTOTAL_API_KEY ?? "").trim()
  if (!apiKey) return null
  const trimmed = targetUrl.trim()
  if (!trimmed) return null
  const urlId = buildVirusTotalUrlId(trimmed)
  try {
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: {
        "x-apikey": apiKey,
        Accept: "application/json",
      },
    })
    if (!response.ok) {
      logger.warn("VirusTotal lookup failed", { status: response.status })
      return null
    }
    const payload = (await response.json()) as {
      data?: { attributes?: { last_analysis_stats?: Record<string, number> } }
    }
    const stats = payload.data?.attributes?.last_analysis_stats
    if (!stats) return null
    const detections = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
    return {
      detections,
      stats,
    }
  } catch (error) {
    logger.error("VirusTotal lookup failed", { error })
    return null
  }
}

function serializeTargetGroups(campaign: GophishCampaign) {
  const names =
    campaign.groups
      ?.map((group) => group.name)
      .filter((name): name is string => Boolean(name && name.trim())) ?? []
  return JSON.stringify(names)
}

function buildMatch(campaign: GophishCampaign): GophishCampaignMatch {
  return {
    campaignId: String(campaign.id),
    campaignName: campaign.name,
    status: campaign.status,
    targetGroups: serializeTargetGroups(campaign),
    landingUrl: campaign.url,
  }
}

async function getCampaignsCached(): Promise<GophishCampaign[]> {
  const now = Date.now()
  if (cachedCampaigns && now - cachedAt < CACHE_TTL_MS) {
    return cachedCampaigns
  }
  if (inflight) return inflight
  inflight = gophishApi
    .getCampaigns()
    .then((campaigns) => {
      cachedCampaigns = campaigns
      cachedAt = Date.now()
      inflight = null
      return campaigns
    })
    .catch((error) => {
      inflight = null
      logger.error("Failed to fetch Gophish campaigns", { error })
      return cachedCampaigns ?? []
    })
  return inflight
}

export async function matchGophishCampaignByRid(
  resultId: string
): Promise<GophishCampaignMatch | null> {
  if (!resultId) return null
  const campaigns = await getCampaignsCached()
  for (const campaign of campaigns) {
    const results = campaign.results ?? []
    const matched = results.find((result) => String(result.id ?? "") === resultId)
    if (matched) {
      return buildMatch(campaign)
    }
  }
  return null
}

export async function matchGophishCampaignByDomain(
  targetUrl: string
): Promise<GophishCampaignMatch | null> {
  const domain = normalizeDomain(targetUrl)
  if (!domain) return null
  const campaigns = await getCampaignsCached()
  for (const campaign of campaigns) {
    const campaignDomain = normalizeDomain(campaign.url ?? "")
    if (!campaignDomain) continue
    if (campaignDomain === domain) {
      return buildMatch(campaign)
    }
  }
  return null
}
