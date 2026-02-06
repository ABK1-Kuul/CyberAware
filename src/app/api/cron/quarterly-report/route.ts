import nodemailer from "nodemailer"
import { NextResponse } from "next/server"
import { logApiRequest } from "@/lib/request-logger"
import { logger } from "@/lib/logger"
import { finalizeAuditReport, generateQuarterlyAudit } from "@/services/compliance-report"

function isQuarterStart(date: Date) {
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  return day === 1 && [0, 3, 6, 9].includes(month)
}

function getAuthToken(request: Request) {
  return (
    request.headers.get("AUTH_TOKEN") ??
    request.headers.get("x-auth-token") ??
    request.headers.get("authorization")
  )
}

function getMailerConfig() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !pass || !from) {
    throw new Error("SMTP configuration is missing.")
  }
  return { host, port, user, pass, from }
}

export async function GET(request: Request) {
  logApiRequest(request)

  const expectedToken = (process.env.AUTH_TOKEN ?? "").trim()
  const providedToken = (getAuthToken(request) ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  if (!isQuarterStart(now)) {
    return NextResponse.json({ message: "Not scheduled quarter start." }, { status: 200 })
  }

  try {
    const report = await generateQuarterlyAudit()
    const { hash, reportData } = await finalizeAuditReport({
      reportId: "organization",
      actorId: null,
      clientIp: "cron",
    })

    const recipients = [
      (process.env.CISO_EMAIL ?? "").trim(),
      (process.env.COMPLIANCE_OFFICER_EMAIL ?? "").trim(),
    ].filter(Boolean)

    if (!recipients.length) {
      return NextResponse.json({ error: "Missing report recipients." }, { status: 500 })
    }

    const config = getMailerConfig()
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    })

    await transporter.sendMail({
      from: config.from,
      to: recipients,
      subject: `Board-Ready Audit Report - ${reportData.periodLabel}`,
      text: `Your quarterly audit report is ready.\n\nReport: ${reportData.title}\nPeriod: ${reportData.periodLabel}\nHash: ${hash}\n\nAttached: ${report.fileName}`,
      html: `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0f172a; padding:20px 28px; color:#ffffff; font-family:'Montserrat', Arial, sans-serif;">
                <div style="font-size:16px; letter-spacing:2px; text-transform:uppercase;">Board-Ready Audit</div>
                <div style="font-size:24px; font-weight:700; margin-top:6px;">${reportData.title}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a;">
                <p style="margin:0 0 12px;">Your quarterly audit report is ready.</p>
                <p style="margin:0 0 8px;"><strong>Period:</strong> ${reportData.periodLabel}</p>
                <p style="margin:0 0 16px;"><strong>Non-repudiation hash:</strong> ${hash}</p>
                <p style="margin:0; font-size:12px; color:#64748b;">The finalized PDF is attached.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      attachments: [
        {
          filename: report.fileName,
          content: report.buffer,
        },
      ],
    })

    return NextResponse.json({ status: "sent", hash, recipients }, { status: 200 })
  } catch (error) {
    logger.error("Quarterly report cron failed", { error })
    return NextResponse.json({ error: "Failed to send quarterly report." }, { status: 500 })
  }
}
