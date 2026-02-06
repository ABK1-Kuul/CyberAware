import { format } from "date-fns"
import { requireUnifiedAuth } from "@/lib/unified-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { logApiRequest } from "@/lib/request-logger"
import { renderPdfFromHtml } from "@/services/certificate-service"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeAchievements(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function getRiskGrade(score: number) {
  if (score <= 10) return "A+"
  if (score <= 20) return "A"
  if (score <= 30) return "A-"
  if (score <= 40) return "B"
  if (score <= 55) return "C"
  if (score <= 70) return "D"
  return "F"
}

function buildResumeHtml(input: {
  name: string
  email: string
  generatedAt: Date
  riskScore: number
  reportingStreak: number
  totalReported: number
  achievements: string[]
}) {
  const achievements = input.achievements.length
    ? input.achievements
        .map((badge) => `<li>${escapeHtml(badge.replace(/_/g, " "))}</li>`)
        .join("")
    : "<li>No achievements earned yet.</li>"

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Security Resume</title>
    <style>
      body {
        font-family: "Inter", "Segoe UI", Arial, sans-serif;
        color: #0f172a;
        margin: 36px;
      }
      h1 {
        font-size: 24px;
        margin: 0 0 6px;
      }
      h2 {
        font-size: 14px;
        margin: 24px 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #475569;
      }
      .meta {
        color: #64748b;
        font-size: 12px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px 14px;
        background: #f8fafc;
      }
      .card .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #64748b;
      }
      .card .value {
        font-size: 22px;
        font-weight: 600;
        margin-top: 6px;
      }
      ul {
        padding-left: 18px;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(input.name)} - Security Resume</h1>
    <div class="meta">${escapeHtml(input.email)} • Generated ${escapeHtml(
      format(input.generatedAt, "MMM dd, yyyy")
    )}</div>

    <section>
      <h2>Risk Summary</h2>
      <div class="summary">
        <div class="card">
          <div class="label">Risk Grade</div>
          <div class="value">${getRiskGrade(input.riskScore)}</div>
          <div class="meta">Score ${input.riskScore}/100</div>
        </div>
        <div class="card">
          <div class="label">Reporting Streak</div>
          <div class="value">${input.reportingStreak}</div>
          <div class="meta">${input.totalReported} total reports</div>
        </div>
        <div class="card">
          <div class="label">Badges Earned</div>
          <div class="value">${input.achievements.length}</div>
          <div class="meta">Achievements unlocked</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Achievements</h2>
      <ul>
        ${achievements}
      </ul>
    </section>
  </body>
</html>`
}

export async function GET(request: Request) {
  logApiRequest(request)

  const auth = await requireUnifiedAuth(request, { requireCookie: true })
  if ("status" in auth) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const profile = await prisma.userRiskProfile.findUnique({
      where: { userId: auth.user.id },
      select: {
        riskScore: true,
        reportingStreak: true,
        totalReported: true,
        achievements: true,
      },
    })

    const html = buildResumeHtml({
      name: auth.user.name || "Learner",
      email: auth.user.email,
      generatedAt: new Date(),
      riskScore: profile?.riskScore ?? 50,
      reportingStreak: profile?.reportingStreak ?? 0,
      totalReported: profile?.totalReported ?? 0,
      achievements: normalizeAchievements(profile?.achievements),
    })

    const pdfBuffer = await renderPdfFromHtml(html, {
      format: "A4",
      landscape: false,
    })

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="security-resume-${auth.user.id}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    logger.error("Security resume export failed", { error })
    return new Response(JSON.stringify({ error: "Failed to generate security resume." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
