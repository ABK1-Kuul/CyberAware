type RatingResponse = {
  rating: "SIMULATION" | "DANGER" | "UNKNOWN"
  severity?: string | null
  blocked?: boolean
  recent?: boolean
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
const CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_API_BASE_URL = "http://localhost:9002"
const NOTIFICATION_POLL_MINUTES = 5
const NOTIFICATION_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAMAAABhv0HIAAAAIVBMVEUAAAD////9/f3R0dGtra2enp6SkpK5ubnGxsb7+vx8AAAAAXRSTlMAQObYZgAAAEVJREFUeAFjYGBgYGRkZmBhYWBkZGRgYGBkZGBgYGRgYGBgYGRgYGBgYGBgYGBgYGDw9fX1EAAH3QkG9H4mBmwAAAABJRU5ErkJggg=="

const cache = new Map<string, { expiresAt: number; rating: RatingResponse }>()
let alertFlashTimer: number | null = null
let alertFlashState = false

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
  const ttl =
    payload.blocked || payload.recent ? 30_000 : payload.rating === "DANGER" ? 60_000 : CACHE_TTL_MS
  cache.set(key, { expiresAt: Date.now() + ttl, rating: payload })
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
    chromeApi.action.setBadgeText({ tabId, text: rating.blocked ? "BLOCK" : "!" })
  }
}

function startAlertFlash() {
  if (!chromeApi?.action?.setBadgeText) return
  if (alertFlashTimer) return
  const toggle = () => {
    alertFlashState = !alertFlashState
    chromeApi.action.setBadgeBackgroundColor({
      color: alertFlashState ? "#dc2626" : "#7f1d1d",
    })
    chromeApi.action.setBadgeText({ text: alertFlashState ? "ALERT" : "!" })
  }
  toggle()
  alertFlashTimer = self.setInterval(toggle, 1200)
}

function stopAlertFlash() {
  if (alertFlashTimer) {
    clearInterval(alertFlashTimer)
    alertFlashTimer = null
    alertFlashState = false
  }
  chromeApi?.action?.setBadgeText?.({ text: "" })
}

async function refreshBadge(tabId: number, url?: string | null) {
  if (!isSupportedUrl(url)) {
    applyBadge(tabId, null)
    return
  }
  const rating = await fetchRating(url)
  applyBadge(tabId, rating)
}

async function fetchNotifications() {
  const { apiBaseUrl, authToken } = await getStorageConfig()
  const baseUrl = apiBaseUrl || DEFAULT_API_BASE_URL
  const endpoint = new URL("/api/reports/notifications", baseUrl)
  if (authToken) endpoint.searchParams.set("token", authToken)
  endpoint.searchParams.set("markRead", "true")
  try {
    const response = await fetch(endpoint.toString(), { credentials: "include" })
    if (!response.ok) return null
    return (await response.json()) as {
      globalNotifications?: Array<{ id: string; title: string; message: string; severity: string }>
      userNotifications?: Array<{ id: string; message: string }>
    }
  } catch {
    return null
  }
}

async function runNotificationPoll() {
  const payload = await fetchNotifications()
  if (!payload) return
  const globalAlerts = payload.globalNotifications ?? []
  const userNotes = payload.userNotifications ?? []

  if (globalAlerts.length) {
    startAlertFlash()
  } else {
    stopAlertFlash()
  }

  if (chromeApi?.notifications?.create && userNotes.length) {
    userNotes.forEach((note) => {
      chromeApi.notifications.create(note.id, {
        type: "basic",
        iconUrl: NOTIFICATION_ICON,
        title: "Security Team Update",
        message: note.message,
        priority: 2,
      })
    })
  }
}

chromeApi?.alarms?.onAlarm?.addListener((alarm: { name: string }) => {
  if (alarm.name === "poll-notifications") {
    runNotificationPoll()
  }
})

chromeApi?.runtime?.onInstalled?.addListener(() => {
  chromeApi?.alarms?.create("poll-notifications", { periodInMinutes: NOTIFICATION_POLL_MINUTES })
  runNotificationPoll()
})

chromeApi?.runtime?.onStartup?.addListener(() => {
  chromeApi?.alarms?.create("poll-notifications", { periodInMinutes: NOTIFICATION_POLL_MINUTES })
  runNotificationPoll()
})

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

chromeApi?.runtime?.onMessage?.addListener(
  (
    message: { type?: string; url?: string },
    _sender: unknown,
    sendResponse: (resp?: RatingResponse | null) => void
  ) => {
    if (message?.type === "CHECK_BLOCKLIST" && message.url) {
      fetchRating(message.url).then((rating) => sendResponse(rating))
      return true
    }
    return false
  }
)
