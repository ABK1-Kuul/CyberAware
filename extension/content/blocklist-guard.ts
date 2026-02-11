type BlocklistResponse = {
  rating: "SIMULATION" | "DANGER" | "UNKNOWN"
  blocked?: boolean
  recent?: boolean
  severity?: string | null
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
const OVERLAY_ID = "cyberaware-blocked-overlay"

function createOverlay(message: string) {
  const overlay = document.createElement("div")
  overlay.id = OVERLAY_ID
  overlay.style.position = "fixed"
  overlay.style.inset = "0"
  overlay.style.zIndex = "2147483647"
  overlay.style.background = "rgba(2, 6, 23, 0.96)"
  overlay.style.color = "#f8fafc"
  overlay.style.fontFamily = "Segoe UI, Inter, sans-serif"
  overlay.style.display = "flex"
  overlay.style.alignItems = "center"
  overlay.style.justifyContent = "center"
  overlay.style.flexDirection = "column"
  overlay.style.textAlign = "center"
  overlay.style.padding = "24px"
  overlay.innerHTML = `
    <div style="max-width:520px;">
      <div style="font-size:12px; letter-spacing:0.2em; text-transform:uppercase; color:#f87171;">Security Alert</div>
      <div style="font-size:24px; font-weight:700; margin:12px 0;">Blocked by Security</div>
      <div style="font-size:14px; color:#cbd5f5;">${message}</div>
    </div>
  `
  document.documentElement.appendChild(overlay)
  return overlay
}

function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID)
  if (existing) existing.remove()
}

function shouldRun() {
  const protocol = window.location.protocol
  if (protocol === "chrome:" || protocol === "edge:" || protocol === "about:") return false
  return true
}

async function checkBlocklist() {
  if (!shouldRun()) return
  if (!chromeApi?.runtime?.sendMessage) return
  chromeApi.runtime.sendMessage(
    { type: "CHECK_BLOCKLIST", url: window.location.href },
    (response: BlocklistResponse | null) => {
      if (!response) return
      if (response.blocked || response.recent) {
        const detail = response.blocked
          ? "Security has blocked this domain due to a verified threat."
          : "Security is investigating recent reports for this domain."
        createOverlay(detail)
      } else {
        removeOverlay()
      }
    }
  )
}

checkBlocklist()
