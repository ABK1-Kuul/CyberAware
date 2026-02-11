import React, { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

type TabInfo = {
  id: number
  url: string
  title?: string
}

type PageSignals = {
  rid?: string | null
  hasTrackingPixel: boolean
  hasForms: boolean
  hasSensitiveInputs: boolean
  subject?: string | null
  headerText?: string | null
  sender?: string | null
  returnPath?: string | null
  messageId?: string | null
  senderIp?: string | null
  bodyText?: string | null
  source?: string | null
  pageTitle?: string | null
  url?: string | null
}

type ReportResponse = {
  type: "SIMULATION" | "EXTERNAL"
  message: string
  reportId?: string
  trackingId?: string
  campaignId?: string | null
  duplicate?: boolean
}

type NotificationPayload = {
  globalNotifications?: Array<{ id: string; title: string; message: string; severity: string }>
  userNotifications?: Array<{ id: string; message: string }>
  recentReports?: Array<{
    id: string
    type: string
    status: string
    targetUrl: string
    createdAt: string
    incidentGroup?: { severity?: string | null }
  }>
  communityImpact?: number
}

type GlobalAlert = { id: string; title: string; message: string; severity: string }

const chromeApi = (globalThis as typeof globalThis & { chrome?: any }).chrome
const DEFAULT_API_BASE_URL = "http://localhost:9002"

function safeHostname(url?: string | null) {
  if (!url) return "unknown"
  try {
    return new URL(url).hostname
  } catch {
    return "unknown"
  }
}

function formatReportStatus(status?: string | null) {
  const normalized = (status ?? "").toUpperCase()
  if (normalized.includes("VERIFIED")) return "Threat Neutralized"
  if (normalized.includes("FALSE")) return "Cleared"
  if (normalized.includes("ARCHIVED")) return "Archived"
  if (normalized.includes("PENDING")) return "Under Investigation"
  return "Queued"
}

function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL)
  const [authToken, setAuthToken] = useState("")
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null)
  const [signals, setSignals] = useState<PageSignals | null>(null)
  const [status, setStatus] = useState<"loading" | "idle" | "submitting" | "success" | "error">(
    "loading"
  )
  const [message, setMessage] = useState("")
  const [reportType, setReportType] = useState<ReportResponse["type"] | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [includeBody, setIncludeBody] = useState(false)
  const [pulse, setPulse] = useState(false)
  const lastHostRef = useRef<string | null>(null)
  const [liveFeed, setLiveFeed] = useState<NotificationPayload["recentReports"]>([])
  const [communityImpact, setCommunityImpact] = useState<number | null>(null)
  const [globalAlert, setGlobalAlert] = useState<GlobalAlert | null>(null)

  useEffect(() => {
    if (!chromeApi?.storage) {
      setStatus("error")
      setError("Chrome extension APIs not available.")
      return
    }
    chromeApi.storage.sync.get(["apiBaseUrl", "authToken"], (result: any) => {
      if (result?.apiBaseUrl) setApiBaseUrl(result.apiBaseUrl)
      if (result?.authToken) setAuthToken(result.authToken)
    })
  }, [])

  useEffect(() => {
    if (!apiBaseUrl) return
    loadLiveFeed()
  }, [apiBaseUrl, authToken])

  useEffect(() => {
    if (!chromeApi?.runtime?.onMessage) return
    const handler = (message: { type?: string; payload?: Partial<PageSignals> }) => {
      if (message?.type !== "WEBMAIL_HEADERS" || !message.payload) return
      setSignals((prev) => {
        const base = prev ?? {
          hasTrackingPixel: false,
          hasForms: false,
          hasSensitiveInputs: false,
        }
        return {
          ...base,
          ...message.payload,
          hasTrackingPixel: base.hasTrackingPixel,
          hasForms: base.hasForms,
          hasSensitiveInputs: base.hasSensitiveInputs,
        }
      })
    }
    chromeApi.runtime.onMessage.addListener(handler)
    return () => {
      chromeApi.runtime.onMessage.removeListener(handler)
    }
  }, [])

  useEffect(() => {
    if (!chromeApi?.tabs || !chromeApi?.scripting) return
    chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      const tab = tabs?.[0]
      if (!tab?.id || !tab?.url) {
        setStatus("error")
        setError("No active tab found.")
        return
      }
      setTabInfo({ id: tab.id, url: tab.url, title: tab.title })
      chromeApi.tabs.sendMessage(tab.id, { type: "REQUEST_HEADERS" }, (response: any) => {
        if (chromeApi.runtime?.lastError) return
        if (response) {
          setSignals((prev) => {
            const base = prev ?? {
              hasTrackingPixel: false,
              hasForms: false,
              hasSensitiveInputs: false,
            }
            return { ...base, ...response }
          })
        }
      })
      chromeApi.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => {
            const pageUrl = window.location.href
            let rid: string | null = null
            try {
              rid = new URL(pageUrl).searchParams.get("rid")
            } catch {
              rid = null
            }
            const trackingImg =
              document.querySelector('img[src*="rid="]') ??
              document.querySelector('img[src*="track?rid="]') ??
              document.querySelector('img[src*="/track"]')
            if (!rid && trackingImg) {
              const src = trackingImg.getAttribute("src") ?? ""
              try {
                rid = new URL(src, window.location.href).searchParams.get("rid")
              } catch {
                rid = null
              }
            }
            const hasForms = Boolean(document.querySelector("form"))
            const hasSensitiveInputs = Boolean(
              document.querySelector(
                'input[type="password"], input[type="email"], input[name*="pass" i], input[name*="bank" i]'
              )
            )
            const subject =
              document.querySelector("h2.hP")?.textContent?.trim() ??
              document.querySelector("[data-test-id='message-subject']")?.textContent?.trim() ??
              document.title
            return {
              rid,
              hasTrackingPixel: Boolean(trackingImg),
              hasForms,
              hasSensitiveInputs,
              subject,
              headerText: null,
              pageTitle: document.title,
              url: pageUrl,
            }
          },
        },
        (results: any[]) => {
          const result = results?.[0]?.result as PageSignals | undefined
          setSignals((prev) => {
            const base = prev ?? {
              hasTrackingPixel: false,
              hasForms: false,
              hasSensitiveInputs: false,
            }
            return { ...base, ...(result ?? {}) }
          })
          setStatus((current) => (current === "loading" ? "idle" : current))
        }
      )
    })
  }, [])

  const hostname = useMemo(() => safeHostname(tabInfo?.url), [tabInfo?.url])
  const highRisk = Boolean(
    signals?.hasSensitiveInputs || signals?.hasTrackingPixel || signals?.hasForms
  )
  const simulationDetected = Boolean(signals?.rid)
  const detectionState = simulationDetected ? "Simulation" : highRisk ? "Unknown" : "Safe"
  const stateClass = detectionState.toLowerCase()

  useEffect(() => {
    if (!hostname || hostname === "unknown") return
    if (hostname !== lastHostRef.current) {
      lastHostRef.current = hostname
      setPulse(true)
      const timer = window.setTimeout(() => setPulse(false), 6000)
      return () => window.clearTimeout(timer)
    }
  }, [hostname])

  async function saveSettings() {
    if (!chromeApi?.storage) return
    chromeApi.storage.sync.set({ apiBaseUrl, authToken }, () => undefined)
  }

  async function captureScreenshot() {
    if (!chromeApi?.tabs?.captureVisibleTab) return null
    return new Promise<string | null>((resolve) => {
      chromeApi.tabs.captureVisibleTab(
        undefined,
        { format: "png" },
        (dataUrl: string) => resolve(dataUrl ?? null)
      )
    })
  }

  async function loadLiveFeed() {
    try {
      const endpoint = new URL("/api/reports/notifications", apiBaseUrl)
      if (authToken) endpoint.searchParams.set("token", authToken)
      const response = await fetch(endpoint.toString(), { credentials: "include" })
      if (!response.ok) return
      const payload = (await response.json()) as NotificationPayload
      setLiveFeed(payload.recentReports ?? [])
      setCommunityImpact(payload.communityImpact ?? null)
      setGlobalAlert(payload.globalNotifications?.[0] ?? null)
    } catch {
      // ignore feed errors
    }
  }

  async function submitReport() {
    if (!tabInfo?.url) return
    setStatus("submitting")
    setError(null)
    setMessage("")
    setReportType(null)
    setTrackingId(null)

    try {
      const screenshot = await captureScreenshot()
      const payload = {
        targetUrl: tabInfo.url,
        emailSubject: signals?.subject ?? undefined,
        headers: signals?.headerText ?? undefined,
        senderIp: signals?.senderIp ?? undefined,
        returnPath: signals?.returnPath ?? undefined,
        messageId: signals?.messageId ?? undefined,
        emailBody: includeBody ? signals?.bodyText ?? undefined : undefined,
        includeBody,
        source: signals?.source ?? "extension",
        pageTitle: signals?.pageTitle ?? undefined,
        screenshot,
      }

      const endpoint = new URL("/api/reports/submit", apiBaseUrl)
      if (authToken) {
        endpoint.searchParams.set("token", authToken)
      }

      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = (await response.json().catch(() => ({}))) as Partial<ReportResponse> & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Report submission failed.")
      }
      setReportType(data.type ?? null)
      setTrackingId(data.trackingId ?? data.reportId ?? null)
      setMessage(data.message ?? "Report submitted.")
      setStatus("success")
      await loadLiveFeed()
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Report submission failed.")
    }
  }

  return (
    <div className="container">
      <style>{`
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          font-family: "Segoe UI", "Inter", sans-serif;
          background: #0b1120;
          color: #e2e8f0;
        }
        .container {
          width: 380px;
          padding: 16px;
          background: #0b1120;
          border: 1px solid #111827;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .subtitle {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-top: 4px;
        }
        .pill {
          font-size: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          border: 1px solid transparent;
        }
        .pill.safe {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.35);
        }
        .pill.unknown {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.35);
        }
        .pill.simulation {
          background: rgba(37, 99, 235, 0.12);
          color: #60a5fa;
          border-color: rgba(37, 99, 235, 0.35);
        }
        .card {
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .hero {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .value {
          font-size: 13px;
          font-weight: 600;
        }
        .signals {
          display: grid;
          gap: 6px;
          margin-top: 10px;
          font-size: 12px;
          color: #cbd5f5;
        }
        .signals span {
          color: #38bdf8;
          font-weight: 600;
        }
        .meta {
          margin-top: 6px;
          font-size: 11px;
          color: #94a3b8;
        }
        .state {
          font-weight: 700;
          margin-left: 4px;
        }
        .state.safe {
          color: #34d399;
        }
        .state.unknown {
          color: #fbbf24;
        }
        .state.simulation {
          color: #60a5fa;
        }
        .button {
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: #1e293b;
          color: #e2e8f0;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.2s ease;
        }
        .button.alert {
          background: #e11d48;
          color: #fff;
          box-shadow: 0 8px 20px rgba(225, 29, 72, 0.3);
        }
        .button.pulse {
          animation: pulse-action 1.6s ease-in-out infinite;
        }
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .status {
          margin-top: 10px;
          font-size: 12px;
        }
        .badge {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #0f766e;
          font-size: 12px;
          font-weight: 700;
          animation: pulse 1.4s ease-in-out infinite;
        }
        .celebration {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: linear-gradient(120deg, rgba(37, 99, 235, 0.2), rgba(14, 116, 144, 0.2));
          border: 1px solid rgba(56, 189, 248, 0.35);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #7dd3fc;
          animation: shimmer 2s ease-in-out infinite;
        }
        .tracking {
          margin-top: 10px;
          font-size: 12px;
          color: #f8fafc;
          background: #1e293b;
          padding: 8px 10px;
          border-radius: 8px;
          word-break: break-all;
        }
        .toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #0f172a;
          border: 1px solid #1f2937;
          margin-bottom: 12px;
        }
        .toggle label {
          font-size: 12px;
          color: #cbd5f5;
          line-height: 1.4;
        }
        .toggle span {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .toggle input {
          appearance: none;
          width: 38px;
          height: 20px;
          background: #1f2937;
          border-radius: 999px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .toggle input::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          background: #e2e8f0;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }
        .toggle input:checked {
          background: #2563eb;
        }
        .toggle input:checked::after {
          transform: translateX(18px);
        }
        .settings {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }
        .input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #1f2937;
          background: #0f172a;
          color: #e2e8f0;
          font-size: 12px;
        }
        .link {
          background: none;
          border: none;
          color: #38bdf8;
          font-size: 12px;
          cursor: pointer;
        }
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(13, 148, 136, 0.4); }
          70% { transform: scale(1.03); box-shadow: 0 0 16px rgba(13, 148, 136, 0.6); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(13, 148, 136, 0.2); }
        }
        @keyframes pulse-action {
          0% { box-shadow: 0 0 0 rgba(59, 130, 246, 0.25); }
          70% { box-shadow: 0 0 18px rgba(59, 130, 246, 0.55); }
          100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0.15); }
        }
        @keyframes shimmer {
          0% { opacity: 0.85; }
          50% { opacity: 1; }
          100% { opacity: 0.85; }
        }
      `}</style>

      <div className="header">
        <div>
          <div className="title">Human Firewall</div>
          <div className="subtitle">Rapid Response Console</div>
        </div>
        <div className={`pill ${stateClass}`}>{detectionState}</div>
      </div>

      <div className="card hero">
        <div className="label">Detection State</div>
        <div className="value">
          We've analyzed this page. It looks{" "}
          <span className={`state ${stateClass}`}>{detectionState}</span>.
        </div>
        <div className="meta">Active domain: {hostname}</div>
      </div>

      <div className="card">
        <div className="label">Telemetry</div>
        <div className="signals">
          <div>
            Tracking pixel: <span>{signals?.hasTrackingPixel ? "Detected" : "No"}</span>
          </div>
          <div>
            Forms present: <span>{signals?.hasForms ? "Yes" : "No"}</span>
          </div>
          <div>
            Sensitive fields: <span>{signals?.hasSensitiveInputs ? "Yes" : "No"}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="label">Forensic Snapshot</div>
        <div className="value">{signals?.subject ?? "Subject not detected"}</div>
        <div className="meta">Sender: {signals?.sender ?? "Not captured"}</div>
        <div className="meta">Return-Path: {signals?.returnPath ?? "Not captured"}</div>
        <div className="meta">Message-ID: {signals?.messageId ?? "Not captured"}</div>
      </div>

      {signals?.bodyText && (
        <div className="toggle">
          <label>
            Include email body for deep analysis?
            <span>Recommended for Finance Dept</span>
          </label>
          <input
            type="checkbox"
            checked={includeBody}
            onChange={(event) => setIncludeBody(event.target.checked)}
          />
        </div>
      )}

      <button
        className={`button ${highRisk ? "alert" : ""} ${pulse ? "pulse" : ""}`}
        disabled={status === "loading" || status === "submitting"}
        onClick={submitReport}
      >
        {status === "submitting" ? "Reporting..." : "Report Phish"}
      </button>

      {status === "loading" && <div className="status">Analyzing current page...</div>}
      {status === "error" && <div className="status">Error: {error}</div>}
      {status === "success" && <div className="status">{message}</div>}

      {(simulationDetected || reportType === "SIMULATION") && (
        <div className="celebration">Security Hero - Simulation Catch</div>
      )}
      {reportType === "SIMULATION" && <div className="badge">Simulation Defeated!</div>}

      {reportType === "EXTERNAL" && trackingId && (
        <div className="tracking">Tracking ID: {trackingId}</div>
      )}

      {globalAlert && (
        <div className="card hero">
          <div className="label">Global Alert</div>
          <div className="value">{globalAlert.title}</div>
          <div className="meta">{globalAlert.message}</div>
        </div>
      )}

      <div className="card">
        <div className="label">Live Feed</div>
        {liveFeed && liveFeed.length ? (
          <div className="signals">
            {liveFeed.map((report) => (
              <div key={report.id}>
                {formatReportStatus(report.status)} •{" "}
                <span>{safeHostname(report.targetUrl)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="meta">No recent reports yet.</div>
        )}
        {communityImpact !== null && (
          <div className="meta">Community Impact: {communityImpact} colleagues protected today.</div>
        )}
      </div>

      <button className="link" onClick={() => setSettingsOpen((open) => !open)}>
        {settingsOpen ? "Hide settings" : "Settings"}
      </button>
      {settingsOpen && (
        <div className="settings">
          <input
            className="input"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder="API Base URL"
          />
          <input
            className="input"
            value={authToken}
            onChange={(event) => setAuthToken(event.target.value)}
            placeholder="Magic token (optional)"
          />
          <button className="button" onClick={saveSettings}>
            Save Settings
          </button>
        </div>
      )}
    </div>
  )
}

const rootElement = document.getElementById("root")
if (rootElement) {
  createRoot(rootElement).render(<App />)
}
