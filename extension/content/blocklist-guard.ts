type BlocklistResponse = {
  rating: "SIMULATION" | "DANGER" | "UNKNOWN"
  blocked?: boolean
  recent?: boolean
  severity?: string | null
  reportCount?: number
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
const OVERLAY_ID = "cyberaware-blocked-overlay"

function getPortalUrl(): Promise<string> {
  return new Promise((resolve) => {
    if (!chromeApi?.storage?.sync) {
      resolve("https://localhost:9002")
      return
    }
    chromeApi.storage.sync.get(["portalUrl", "apiBaseUrl"], (result: any) => {
      const raw = result?.portalUrl ?? result?.apiBaseUrl ?? "https://localhost:9002"
      const normalized = raw.includes("://") ? raw : `https://${raw}`
      resolve(normalized)
    })
  })
}

function createOverlay(input: {
  message: string
  reason: string
  severity?: string | null
  portalUrl: string
  reportCount?: number
}) {
  const existing = document.getElementById(OVERLAY_ID)
  if (existing) existing.remove()
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
    <div style="max-width:560px; background:rgba(15, 23, 42, 0.65); border:1px solid rgba(148, 163, 184, 0.25); border-radius:16px; padding:24px;">
      <div style="font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:#f87171;">Security Intervention</div>
      <div style="font-size:26px; font-weight:700; margin:12px 0;">
        This site was blocked by the Human Firewall.
      </div>
      <div style="font-size:14px; color:#cbd5f5; margin-bottom:8px;">
        Reason: ${input.reason}
      </div>
      <div style="font-size:12px; color:#94a3b8; margin-bottom:18px;">
        ${input.message}
      </div>
      <button id="human-firewall-safe-exit" style="background:#2563eb; color:#f8fafc; border:none; border-radius:10px; padding:12px 18px; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer;">
        Back to Safety
      </button>
      <div style="font-size:11px; color:#64748b; margin-top:14px;">
        Severity: ${input.severity ?? "UNKNOWN"} • Reported by ${input.reportCount ?? "multiple"} colleagues
      </div>
    </div>
  `
  document.documentElement.appendChild(overlay)
  const button = overlay.querySelector<HTMLButtonElement>("#human-firewall-safe-exit")
  if (button) {
    button.addEventListener("click", () => {
      window.location.href = input.portalUrl
    })
  }
  document.documentElement.style.overflow = "hidden"
  if (document.body) {
    document.body.style.overflow = "hidden"
  }
  return overlay
}

function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID)
  if (existing) existing.remove()
  document.documentElement.style.overflow = ""
  if (document.body) {
    document.body.style.overflow = ""
  }
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
    async (response: BlocklistResponse | null) => {
      if (!response) return
      if (response.blocked || response.recent) {
        const countLabel =
          typeof response.reportCount === "number"
            ? `${response.reportCount} colleagues`
            : "multiple colleagues"
        const reason = response.blocked
          ? `Verified Phishing Threat (Reported by ${countLabel}).`
          : `Under Investigation (Reported by ${countLabel}).`
        const detail = response.blocked
          ? "Security has blocked this domain due to a verified threat."
          : "Security is investigating recent reports for this domain."
        const portalUrl = await getPortalUrl()
        createOverlay({
          message: detail,
          reason,
          severity: response.severity,
          portalUrl,
          reportCount: response.reportCount,
        })
      } else {
        removeOverlay()
      }
    }
  )
}

checkBlocklist()
