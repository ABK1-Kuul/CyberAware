import type { AuditReportData } from "@/services/compliance-report"

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "-"
  return `${value}s`
}

function getCapabilityTrendLabel(trend: AuditReportData["capabilityTrend"]) {
  if (trend === "improving") return { label: "Improving", className: "text-emerald-700" }
  if (trend === "declining") return { label: "Declining", className: "text-red-700" }
  if (trend === "flat") return { label: "Stable", className: "text-amber-700" }
  return { label: "Insufficient data", className: "text-slate-500" }
}

function buildTrendPath(data: AuditReportData["trend"], width: number, height: number) {
  if (!data.length) return ""
  const padding = 18
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const step = data.length > 1 ? usableWidth / (data.length - 1) : 0
  return data
    .map((point, index) => {
      const x = padding + index * step
      const y =
        height - padding - (Math.max(0, Math.min(100, point.resilienceScore)) / 100) * usableHeight
      return `${x},${y}`
    })
    .join(" ")
}

function getSeverity(accessWeight: number, failureRate: number) {
  const probability = Math.max(1, Math.min(5, Math.ceil(failureRate * 5) || 1))
  return accessWeight * probability
}

function getSeverityLabel(accessWeight: number, failureRate: number) {
  const score = getSeverity(accessWeight, failureRate)
  if (score >= 16) return { label: "Red", className: "bg-red-100 text-red-800" }
  if (score >= 9) return { label: "Yellow", className: "bg-amber-100 text-amber-800" }
  return { label: "Green", className: "bg-emerald-100 text-emerald-800" }
}

export function AuditReportTemplate({
  data,
  options,
}: {
  data: AuditReportData
  options?: { showFinancialRoi?: boolean }
}) {
  const showFinancialRoi = options?.showFinancialRoi !== false
  const trendWidth = 640
  const trendHeight = 160
  const trendPath = buildTrendPath(data.trend, trendWidth, trendHeight)

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white px-10 py-8 text-slate-900">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .print-hidden { display: none !important; }
        }
      `}</style>

      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CISO Executive Suite</p>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-xs text-slate-500">
            {data.organizationName} • {data.periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {data.complianceStatus}
          </div>
          <div className="text-xs text-slate-500">
            Report Date
            <div className="font-mono text-slate-800">
              {new Date(data.reportDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Coverage</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatPercent(data.coveragePercent)}
          </p>
          <p className="text-xs text-slate-500">
            {data.coverageTestedUsers} tested of {data.coverageTotalUsers} AD users
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Configuration</p>
          <p
            className={`mt-2 text-3xl font-semibold ${
              data.configurationCompliant ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {data.configurationCompliant ? "Compliant" : "Needs Review"}
          </p>
          <p className="text-xs text-slate-500">
            DORA Article 13 completion {formatPercent(data.configurationCompletionRate)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Capability</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatSeconds(data.capabilityCurrentSeconds)}
          </p>
          <p className="text-xs text-slate-500">
            Prev {formatSeconds(data.capabilityPreviousSeconds)} •{" "}
            <span className={getCapabilityTrendLabel(data.capabilityTrend).className}>
              {getCapabilityTrendLabel(data.capabilityTrend).label}
            </span>
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resilience Score</p>
          <p className="mt-2 text-3xl font-semibold">{data.resilienceScore}</p>
          <p className="text-xs text-slate-500">Risk score: {data.riskScore}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Human Firewall
          </p>
          <p className="mt-2 text-3xl font-semibold">{data.humanFirewall.averageSeconds}s</p>
          <p className="text-xs text-slate-500">
            {data.humanFirewall.count} campaigns • {data.humanFirewall.pending} pending
          </p>
        </div>
        {showFinancialRoi ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total ROI</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatCurrency(data.avoidedBreachCost)}
            </p>
            <p className="text-xs text-slate-500">
              {data.totalSuccessfulReports} reports ×{" "}
              {formatCurrency(data.averageRemediationCost)}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          Resilience Burndown
        </h2>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {data.trend.length ? (
            <svg width="100%" viewBox={`0 0 ${trendWidth} ${trendHeight}`} className="text-slate-600">
              <polyline
                fill="none"
                stroke="#1f2937"
                strokeWidth="3"
                points={trendPath}
              />
              {data.trend.map((point, index) => {
                const x =
                  18 +
                  (data.trend.length > 1
                    ? (index * (trendWidth - 36)) / (data.trend.length - 1)
                    : 0)
                const y =
                  trendHeight -
                  18 -
                  (Math.max(0, Math.min(100, point.resilienceScore)) / 100) *
                    (trendHeight - 36)
                return (
                  <circle key={point.month} cx={x} cy={y} r="4" fill="#2563eb" />
                )
              })}
              <line x1="18" y1={trendHeight - 18} x2={trendWidth - 18} y2={trendHeight - 18} stroke="#cbd5f5" />
            </svg>
          ) : (
            <p className="text-xs text-slate-500">Trend data not available.</p>
          )}
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            {data.trend.map((point) => (
              <span key={point.month}>{point.month}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          Departmental Heatmap
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Access Weight</th>
                <th className="px-3 py-2 text-left">Failure Rate</th>
                <th className="px-3 py-2 text-left">Risk Score</th>
                <th className="px-3 py-2 text-left">TLP</th>
              </tr>
            </thead>
            <tbody>
              {data.heatmap.length ? (
                data.heatmap.map((row) => {
                  const severity = getSeverityLabel(row.accessWeight, row.failureRate)
                  return (
                    <tr key={row.name} className="border-t border-slate-200">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono">{row.accessWeight}</td>
                      <td className="px-3 py-2 font-mono">{formatPercent(row.failureRate)}</td>
                      <td className="px-3 py-2 font-mono">{row.riskScore}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${severity.className}`}
                        >
                          {severity.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    No heatmap data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          Departmental Breakdown
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Department</th>
                <th className="px-3 py-2 text-left">Total Users</th>
                <th className="px-3 py-2 text-left">Click Rate</th>
                <th className="px-3 py-2 text-left">Training Completion</th>
                <th className="px-3 py-2 text-left">Grade</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.length ? (
                data.departments.map((dept) => (
                  <tr key={dept.name} className="border-t border-slate-200">
                    <td className="px-3 py-2">{dept.name}</td>
                    <td className="px-3 py-2 font-mono">{dept.totalUsers}</td>
                    <td className="px-3 py-2 font-mono">{formatPercent(dept.clickRate)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatPercent(dept.trainingCompletionRate)}
                    </td>
                    <td className="px-3 py-2 font-mono">{dept.grade}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    No department breakdown data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          Audit Trail
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Campaign</th>
                <th className="px-3 py-2 text-left">Threat Scenario</th>
                <th className="px-3 py-2 text-left">Compliance</th>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">Stop</th>
              </tr>
            </thead>
            <tbody>
              {data.auditTrail.length ? (
                data.auditTrail.map((entry) => (
                  <tr key={entry.campaignId} className="border-t border-slate-200">
                    <td className="px-3 py-2">{entry.campaignName}</td>
                    <td className="px-3 py-2">{entry.threatScenario ?? "-"}</td>
                    <td className="px-3 py-2">{entry.complianceStatus ?? "-"}</td>
                    <td className="px-3 py-2 font-mono">
                      {entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {entry.stoppedAt ? new Date(entry.stoppedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    No campaign audit entries for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
