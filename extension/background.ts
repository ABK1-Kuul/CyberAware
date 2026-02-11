type RatingResponse = {
  rating: "SIMULATION" | "DANGER" | "UNKNOWN"
  severity?: string | null
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
const CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_API_BASE_URL = "http://localhost:9002"

const cache = new Map<string, { expiresAt: number; rating: RatingResponse }>()

function getUrlKey(url?: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return null
  }
}

function isSupportedUrl(url?: string | null) {
  if (!url) return false
  return !url.startsWith("chrome://") && !url.startsWith("edge://") && !url.startsWith("about:")
}

function getStorageConfig(): Promise<{ apiBaseUrl?: string; authToken?: string }> {
  if (!chromeApi?.storage?.sync) return Promise.resolve({})
  return new Promise((resolve) => {
    chromeApi.storage.sync.get(["apiBaseUrl", "authToken"], (result: any) => {
      resolve(result ?? {})
    })
  })
}

async function fetchRating(url: string): Promise<RatingResponse | null> {
  const key = getUrlKey(url)
  if (!key) return null
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.rating

  const { apiBaseUrl, authToken } = await getStorageConfig()
  const baseUrl = apiBaseUrl || DEFAULT_API_BASE_URL
  try {
    const endpoint = new URL("/api/reports/lookup", baseUrl)
    endpoint.searchParams.set("url", url)
    if (authToken) endpoint.searchParams.set("token", authToken)
    const response = await fetch(endpoint.toString(), { credentials: "include" })
    if (!response.ok) return null
    const payload = (await response.json()) as RatingResponse
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, rating: payload })
    return payload
  } catch {
    return null
  }
}

function applyBadge(tabId: number, rating: RatingResponse | null) {
  if (!chromeApi?.action?.setBadgeText) return
  if (!rating || rating.rating === "UNKNOWN") {
    chromeApi.action.setBadgeText({ tabId, text: "" })
    return
  }
  if (rating.rating === "SIMULATION") {
    chromeApi.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" })
    chromeApi.action.setBadgeText({ tabId, text: "SIM" })
    return
  }
  if (rating.rating === "DANGER") {
    chromeApi.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" })
    chromeApi.action.setBadgeText({ tabId, text: "!" })
  }
}

async function refreshBadge(tabId: number, url?: string | null) {
  if (!isSupportedUrl(url)) {
    applyBadge(tabId, null)
    return
  }
  const rating = await fetchRating(url)
  applyBadge(tabId, rating)
}

chromeApi?.tabs?.onActivated?.addListener((activeInfo: { tabId: number }) => {
  chromeApi.tabs.get(activeInfo.tabId, (tab: { id: number; url?: string }) => {
    if (!tab?.id) return
    refreshBadge(tab.id, tab.url)
  })
})

chromeApi?.tabs?.onUpdated?.addListener(
  (tabId: number, changeInfo: { status?: string }, tab: { url?: string }) => {
    if (changeInfo.status === "complete") {
      refreshBadge(tabId, tab.url)
    }
  }
)
