type WebmailPayload = {
  source: "gmail" | "outlook"
  sender?: string | null
  returnPath?: string | null
  subject?: string | null
  messageId?: string | null
  senderIp?: string | null
  headerText?: string | null
  bodyText?: string | null
  rid?: string | null
  url?: string | null
}

const MAX_TEXT_CHARS = 8000
const MAX_BODY_CHARS = 5000
const RIBBON_ID = "cyberaware-human-firewall-ribbon"

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome

function trimText(value?: string | null, maxChars = MAX_TEXT_CHARS) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed
}

function parseHeaderText(headerText?: string | null) {
  if (!headerText) return {}
  const returnPathMatch = headerText.match(/Return-Path:\s*<?([^>\n]+)>?/i)
  const messageIdMatch = headerText.match(/Message-ID:\s*<?([^>\n]+)>?/i)
  const senderIpMatch =
    headerText.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/) ?? headerText.match(/\b[a-f0-9:]{3,}\b/i)
  return {
    returnPath: returnPathMatch?.[1]?.trim(),
    messageId: messageIdMatch?.[1]?.trim(),
    senderIp: senderIpMatch?.[0]?.trim(),
  }
}

function findRidInLinks(anchors: HTMLAnchorElement[]) {
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? ""
    if (!href) continue
    try {
      const url = new URL(href, window.location.href)
      const rid = url.searchParams.get("rid")
      if (rid) return rid
    } catch {
      // ignore malformed URLs
    }
  }
  return null
}

function scrapeGmail(): WebmailPayload | null {
  const subject =
    document.querySelector("h2.hP")?.textContent?.trim() ??
    document.querySelector("[data-test-id='message-subject']")?.textContent?.trim() ??
    document.title

  const senderElement =
    document.querySelector("span.gD") ??
    document.querySelector("span.g2") ??
    document.querySelector("[data-testid='message-header-from']")
  const sender =
    (senderElement as HTMLElement | null)?.getAttribute("email") ??
    senderElement?.textContent?.trim() ??
    null

  const messageId =
    document.querySelector("[data-message-id]")?.getAttribute("data-message-id") ??
    document.querySelector("[data-legacy-message-id]")?.getAttribute("data-legacy-message-id") ??
    null

  const bodyElement = document.querySelector("div.a3s") as HTMLElement | null
  const bodyText = trimText(bodyElement?.innerText ?? null, MAX_BODY_CHARS)

  const headerPanel = document.querySelector("pre")?.textContent ?? null
  const headerText = trimText(headerPanel)

  const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[]
  const rid = findRidInLinks(anchors)

  const parsed = parseHeaderText(headerText)
  return {
    source: "gmail",
    sender: trimText(sender),
    returnPath: parsed.returnPath ?? null,
    subject: trimText(subject),
    messageId: parsed.messageId ?? messageId,
    senderIp: parsed.senderIp ?? null,
    headerText,
    bodyText,
    rid,
    url: window.location.href,
  }
}

function scrapeOutlook(): WebmailPayload | null {
  const subject =
    document.querySelector("[data-testid='message-subject']")?.textContent?.trim() ??
    document.querySelector("span[role='heading']")?.textContent?.trim() ??
    document.title

  const senderElement =
    document.querySelector("[data-testid='message-header-from']") ??
    document.querySelector("button[aria-label^='From']") ??
    document.querySelector("div[aria-label^='From']")
  const sender =
    senderElement?.getAttribute("title") ??
    senderElement?.getAttribute("aria-label") ??
    senderElement?.textContent?.trim() ??
    null

  const detailsPanel =
    document.querySelector("textarea[aria-label*='Internet headers']") ??
    document.querySelector("pre[aria-label*='Internet headers']") ??
    document.querySelector("[aria-label='Message details'] textarea") ??
    document.querySelector("[aria-label='Message details'] pre")
  const headerText = trimText((detailsPanel as HTMLElement | null)?.textContent ?? null)

  const bodyElement =
    document.querySelector("div[role='document']") ??
    document.querySelector("div[aria-label='Message body']")
  const bodyText = trimText((bodyElement as HTMLElement | null)?.innerText ?? null, MAX_BODY_CHARS)

  const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[]
  const rid = findRidInLinks(anchors)

  const parsed = parseHeaderText(headerText)
  return {
    source: "outlook",
    sender: trimText(sender),
    returnPath: parsed.returnPath ?? null,
    subject: trimText(subject),
    messageId: parsed.messageId ?? null,
    senderIp: parsed.senderIp ?? null,
    headerText,
    bodyText,
    rid,
    url: window.location.href,
  }
}

function isPotentialThreat(payload: WebmailPayload) {
  const text = `${payload.subject ?? ""} ${payload.bodyText ?? ""}`.toLowerCase()
  const hasTrigger =
    text.includes("verify") ||
    text.includes("urgent") ||
    text.includes("password") ||
    text.includes("login") ||
    text.includes("invoice")
  const hasLink = /https?:\/\//i.test(payload.bodyText ?? "")
  return Boolean(payload.rid || hasLink || hasTrigger)
}

function ensureRibbon(payload: WebmailPayload) {
  const shouldShow = isPotentialThreat(payload)
  const existing = document.getElementById(RIBBON_ID)
  if (!shouldShow) {
    if (existing) existing.remove()
    return
  }
  if (existing) return
  const ribbon = document.createElement("div")
  ribbon.id = RIBBON_ID
  ribbon.textContent =
    payload.rid ? "Simulation detected. Ready to report." : "Potential threat detected."
  ribbon.style.position = "sticky"
  ribbon.style.top = "0"
  ribbon.style.zIndex = "2147483647"
  ribbon.style.padding = "8px 12px"
  ribbon.style.background = "rgba(15, 23, 42, 0.92)"
  ribbon.style.color = "#e2e8f0"
  ribbon.style.fontSize = "12px"
  ribbon.style.letterSpacing = "0.08em"
  ribbon.style.textTransform = "uppercase"
  ribbon.style.borderBottom = "1px solid rgba(148, 163, 184, 0.2)"
  document.body.prepend(ribbon)
}

function getPayload(): WebmailPayload | null {
  const host = window.location.hostname
  if (host.includes("mail.google.com")) return scrapeGmail()
  if (host.includes("outlook")) return scrapeOutlook()
  return null
}

let lastSignature = ""

function sendPayload(payload: WebmailPayload) {
  if (!chromeApi?.runtime?.sendMessage) return
  const signature = JSON.stringify(payload)
  if (signature === lastSignature) return
  lastSignature = signature
  chromeApi.runtime.sendMessage({ type: "WEBMAIL_HEADERS", payload })
}

function runScrape() {
  const payload = getPayload()
  if (!payload) return
  ensureRibbon(payload)
  sendPayload(payload)
}

const observer = new MutationObserver(() => {
  window.clearTimeout((observer as any)._timer)
  ;(observer as any)._timer = window.setTimeout(() => runScrape(), 400)
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
})

chromeApi?.runtime?.onMessage?.addListener(
  (message: { type?: string }, _sender: unknown, sendResponse: (resp?: any) => void) => {
    if (message?.type === "REQUEST_HEADERS") {
      const payload = getPayload()
      if (payload) {
        ensureRibbon(payload)
      }
      sendResponse(payload ?? null)
    }
  }
)

runScrape()
