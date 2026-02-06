import path from "path"
import fs from "fs/promises"
import { randomUUID } from "crypto"
import { format } from "date-fns"
import nodemailer from "nodemailer"
import puppeteer from "puppeteer"
import { prisma } from "@/lib/prisma"

type CertificateTemplateInput = {
  recipientName: string
  courseTitle: string
  completionDate: Date
  certificateId: string
}

const CERTIFICATE_DIR = path.join(process.cwd(), "public", "certificates")
const MAX_PDF_CONCURRENCY = Math.max(
  1,
  Number(process.env.CERTIFICATE_PDF_CONCURRENCY ?? 3) || 3
)
const MAX_BROWSER_USES = 100
const ENABLE_PDF_QUEUE_LOGS = process.env.CERTIFICATE_PDF_LOGS === "true"
let warmBrowser: puppeteer.Browser | null = null
let warmBrowserPromise: Promise<puppeteer.Browser> | null = null
let warmBrowserStartedAt: number | null = null
let lastRestartTime: number | null = null
let openPageCount = 0
let totalCertificatesGenerated = 0
let browserUseCount = 0
let recycleRequested = false
let recycleInProgress = false

function registerShutdownHandler() {
  const globalKey = "__certificateServiceShutdownRegistered"
  const globalAny = globalThis as typeof globalThis & { [key: string]: boolean }
  if (globalAny[globalKey]) return
  globalAny[globalKey] = true

  const closeWarmBrowser = () => {
    if (warmBrowser) {
      warmBrowser.close().catch(() => undefined)
    }
  }

  process.on("SIGTERM", closeWarmBrowser)
  process.on("SIGINT", closeWarmBrowser)
}

registerShutdownHandler()

function createConcurrencyLimiter(limit: number) {
  let active = 0
  const queue: Array<() => void> = []

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        if (ENABLE_PDF_QUEUE_LOGS) {
          console.info(
            `[certificate-service] queued request queue=${queue.length + 1}`
          )
        }
        queue.push(resolve)
      })
    }

    active += 1
    if (ENABLE_PDF_QUEUE_LOGS) {
      console.info(
        `[certificate-service] slot granted ${active}/${limit} queue=${queue.length}`
      )
    }

    try {
      return await task()
    } finally {
      active = Math.max(0, active - 1)
      if (ENABLE_PDF_QUEUE_LOGS) {
        console.info(
          `[certificate-service] slot released ${active}/${limit} queue=${queue.length}`
        )
      }
      const next = queue.shift()
      if (next) next()
    }
  }
}

const runPdfTask = createConcurrencyLimiter(MAX_PDF_CONCURRENCY)

async function maybeRecycleBrowser() {
  if (!recycleRequested || recycleInProgress) return
  if (openPageCount > 0) return
  if (!warmBrowser) {
    recycleRequested = false
    browserUseCount = 0
    return
  }
  recycleInProgress = true
  const browser = warmBrowser
  warmBrowser = null
  warmBrowserPromise = null
  warmBrowserStartedAt = null
  browserUseCount = 0
  try {
    await browser.close()
  } catch {
    // ignore close errors
  } finally {
    if (ENABLE_PDF_QUEUE_LOGS) {
      console.info("[certificate-service] warm browser recycled")
    }
    recycleRequested = false
    recycleInProgress = false
  }
}

async function getWarmBrowser(): Promise<puppeteer.Browser> {
  if (warmBrowser && warmBrowser.isConnected()) {
    return warmBrowser
  }
  if (warmBrowserPromise) {
    return warmBrowserPromise
  }
  warmBrowserPromise = puppeteer
    .launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    .then((browser) => {
      warmBrowser = browser
      warmBrowserPromise = null
      warmBrowserStartedAt = Date.now()
      lastRestartTime = warmBrowserStartedAt
      browserUseCount = 0
      recycleRequested = false
      browser.on("disconnected", () => {
        warmBrowser = null
        warmBrowserStartedAt = null
        openPageCount = 0
        browserUseCount = 0
        recycleRequested = false
      })
      return browser
    })
    .catch((error) => {
      warmBrowserPromise = null
      throw error
    })
  return warmBrowserPromise
}

function buildCertificateHtml(input: CertificateTemplateInput): string {
  const issueDate = format(input.completionDate, "MMMM d, yyyy")
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Certificate</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      @page { size: A4 landscape; margin: 0; }
      body { margin: 0; font-family: "Montserrat", "Georgia", "Times New Roman", serif; color: #0f172a; }
      .canvas {
        position: relative;
        width: 297mm;
        height: 210mm;
        background: #f8fafc;
        border: 20px solid #0f172a;
        box-sizing: border-box;
      }
      .inner-border {
        position: absolute;
        inset: 18px;
        border: 2px solid #1e293b;
      }
      .title {
        position: absolute;
        top: 22mm;
        width: 100%;
        text-align: center;
        font-size: 42px;
        letter-spacing: 4px;
        text-transform: uppercase;
      }
      .subtitle {
        position: absolute;
        top: 40mm;
        width: 100%;
        text-align: center;
        font-size: 20px;
        color: #475569;
      }
      .name {
        position: absolute;
        top: 78mm;
        width: 100%;
        text-align: center;
        font-size: 54px;
        font-weight: 700;
        color: #1d4ed8;
      }
      .course {
        position: absolute;
        top: 112mm;
        width: 100%;
        text-align: center;
        font-size: 28px;
        font-weight: 600;
      }
      .date {
        position: absolute;
        bottom: 28mm;
        left: 25mm;
        width: 70mm;
        text-align: center;
        font-size: 16px;
        border-top: 1px solid #475569;
        padding-top: 6px;
      }
      .signature {
        position: absolute;
        bottom: 28mm;
        right: 25mm;
        width: 70mm;
        text-align: center;
        font-size: 16px;
        border-top: 1px solid #475569;
        padding-top: 6px;
      }
      .id {
        position: absolute;
        bottom: 12mm;
        width: 100%;
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
        letter-spacing: 2px;
      }
    </style>
  </head>
  <body>
    <div class="canvas">
      <div class="inner-border"></div>
      <div class="title">Certificate of Completion</div>
      <div class="subtitle">This certifies that</div>
      <div class="name">${input.recipientName}</div>
      <div class="subtitle" style="top: 98mm;">has successfully completed</div>
      <div class="course">${input.courseTitle}</div>
      <div class="date">${issueDate}</div>
      <div class="signature">Authorized Signature</div>
      <div class="id">Certificate ID: ${input.certificateId}</div>
    </div>
  </body>
</html>`
}

type PdfRenderOptions = {
  format?: "A4" | "Letter"
  landscape?: boolean
  timeoutMs?: number
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2"
}

export async function renderPdfFromHtml(
  html: string,
  options: PdfRenderOptions = {}
): Promise<Buffer> {
  return runPdfTask(async () => {
    let page: puppeteer.Page | null = null
    let pageTracked = false
    const timeoutMs = options.timeoutMs ?? 30_000
    try {
      const browser = await getWarmBrowser()
      page = await browser.newPage()
      openPageCount += 1
      pageTracked = true
      page.setDefaultTimeout(timeoutMs)
      await page.setContent(html, { waitUntil: "networkidle0" })
      const pdfBuffer = await page.pdf({
        format: options.format ?? "A4",
        landscape: options.landscape ?? false,
        printBackground: true,
        preferCSSPageSize: true,
        timeout: timeoutMs,
      })
      browserUseCount += 1
      if (browserUseCount >= MAX_BROWSER_USES) {
        recycleRequested = true
      }
      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed."
      const normalized = message.toLowerCase()
      if (normalized.includes("browser disconnected") || normalized.includes("target closed")) {
        warmBrowser = null
        throw new Error("PDF generation failed: browser disconnected.")
      }
      if (normalized.includes("timeout")) {
        throw new Error("PDF generation failed: PDF generation timeout.")
      }
      throw new Error(`PDF generation failed: ${message}`)
    } finally {
      if (page) {
        await page.close().catch(() => undefined)
      }
      if (pageTracked) {
        openPageCount = Math.max(0, openPageCount - 1)
      }
      await maybeRecycleBrowser()
    }
  })
}

export async function renderPdfFromUrl(
  url: string,
  options: PdfRenderOptions = {}
): Promise<Buffer> {
  return runPdfTask(async () => {
    let page: puppeteer.Page | null = null
    let pageTracked = false
    const timeoutMs = options.timeoutMs ?? 30_000
    try {
      const browser = await getWarmBrowser()
      page = await browser.newPage()
      openPageCount += 1
      pageTracked = true
      page.setDefaultTimeout(timeoutMs)
      await page.goto(url, { waitUntil: options.waitUntil ?? "networkidle0" })
      const pdfBuffer = await page.pdf({
        format: options.format ?? "A4",
        landscape: options.landscape ?? false,
        printBackground: true,
        preferCSSPageSize: true,
        timeout: timeoutMs,
      })
      browserUseCount += 1
      if (browserUseCount >= MAX_BROWSER_USES) {
        recycleRequested = true
      }
      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed."
      const normalized = message.toLowerCase()
      if (normalized.includes("browser disconnected") || normalized.includes("target closed")) {
        warmBrowser = null
        throw new Error("PDF generation failed: browser disconnected.")
      }
      if (normalized.includes("timeout")) {
        throw new Error("PDF generation failed: PDF generation timeout.")
      }
      throw new Error(`PDF generation failed: ${message}`)
    } finally {
      if (page) {
        await page.close().catch(() => undefined)
      }
      if (pageTracked) {
        openPageCount = Math.max(0, openPageCount - 1)
      }
      await maybeRecycleBrowser()
    }
  })
}

async function renderCertificatePdf(input: CertificateTemplateInput): Promise<Buffer> {
  const pdfBuffer = await renderPdfFromHtml(buildCertificateHtml(input), {
    format: "A4",
    landscape: true,
  })
  totalCertificatesGenerated += 1
  return pdfBuffer
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

function sanitizeFilenameSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
  return cleaned || "Learner"
}

async function sendCertificateEmail({
  to,
  name,
  courseTitle,
  certificateUrl,
  pdfBuffer,
}: {
  to: string
  name: string
  courseTitle: string
  certificateUrl: string
  pdfBuffer: Buffer
}) {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  const safeName = sanitizeFilenameSegment(name)

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "🎓 Congratulations! Your Cyber Awareness Certificate has arrived.",
    text: `Cyber Hero!\n\nHi ${name},\n\nYour certificate for ${courseTitle} is ready.\nSecure download: ${certificateUrl}\n\nThank you.`,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f1f5f9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0f172a; padding:24px 32px; color:#ffffff; font-family:'Montserrat', Arial, sans-serif;">
                <div style="font-size:18px; letter-spacing:2px; text-transform:uppercase;">Cyber Awareness</div>
                <div style="font-size:28px; font-weight:700; margin-top:6px;"><strong>Cyber Hero</strong></div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a;">
                <p style="margin:0 0 8px; font-size:16px;">Hi</p>
                <div style="font-family:'Great Vibes', 'Brush Script MT', cursive; font-size:36px; color:#1d4ed8; margin:0 0 16px;">
                  ${name}
                </div>
                <p style="margin:0 0 16px; font-size:16px;">
                  Congratulations on completing <strong>${courseTitle}</strong>. Your certificate is ready and attached to this email.
                </p>
                <p style="margin:0 0 24px; font-size:16px;">
                  Use the secure button below to download it again anytime.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${certificateUrl}" style="background:#1d4ed8; color:#ffffff; padding:14px 22px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:600;">
                    Download Your Certificate Again
                  </a>
                </p>
                <p style="margin:0; font-size:12px; color:#64748b;">
                  If the button doesn't work, paste this link in your browser: ${certificateUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px; background:#f8fafc; font-family:'Montserrat', Arial, sans-serif; color:#64748b; font-size:12px;">
                Stay vigilant. Stay secure.
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
        filename: `CyberAwareness_Certificate_${safeName}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}

async function sendSecurityAlertEmail({
  to,
  name,
  eventType,
  campaignName,
}: {
  to: string
  name: string
  eventType: string
  campaignName?: string | null
}) {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  const appBaseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "")
  const portalUrl = appBaseUrl || undefined

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Security Alert: Immediate Training Required",
    text: `Hi ${name},\n\nWe detected a security event (${eventType})${
      campaignName ? ` in campaign "${campaignName}".` : "."
    }\n\nPlease complete the required security training as soon as possible.${
      portalUrl ? `\n\nTraining portal: ${portalUrl}` : ""
    }\n\nIf you believe this was a mistake, contact your security team.`,
    html: `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#b91c1c; padding:20px 28px; color:#ffffff; font-family:'Montserrat', Arial, sans-serif;">
                <div style="font-size:16px; letter-spacing:2px; text-transform:uppercase;">Security Alert</div>
                <div style="font-size:24px; font-weight:700; margin-top:6px;">Immediate Training Required</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a;">
                <p style="margin:0 0 12px;">Hi ${name},</p>
                <p style="margin:0 0 16px;">
                  We detected a security event (<strong>${eventType}</strong>)${
                    campaignName ? ` in campaign <strong>${campaignName}</strong>.` : "."
                  }
                </p>
                <p style="margin:0 0 16px;">
                  Please complete the required security training as soon as possible.
                </p>
                ${
                  portalUrl
                    ? `<p style="margin:0 0 16px;">
                  <a href="${portalUrl}" style="background:#0f172a; color:#ffffff; padding:12px 18px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:600;">
                    Open Training Portal
                  </a>
                </p>`
                    : ""
                }
                <p style="margin:0; font-size:12px; color:#64748b;">
                  If you believe this was a mistake, contact your security team.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })
}

async function upsertCertificateRecord({
  enrollmentId,
  certificateId,
  issuedAt,
  publicPath,
}: {
  enrollmentId: string
  certificateId: string
  issuedAt: Date
  publicPath: string
}) {
  const existing = await prisma.certificate.findUnique({
    where: { enrollmentId },
  })
  if (existing) {
    return prisma.certificate.update({
      where: { id: existing.id },
      data: {
        path: publicPath,
        issuedAt,
      },
    })
  }
  return prisma.certificate.create({
    data: {
      enrollmentId,
      path: publicPath,
      uuid: certificateId,
      issuedAt,
    },
  })
}

export const certificateService = {
  getHealthMetrics() {
    const uptime = warmBrowserStartedAt
      ? Math.floor((Date.now() - warmBrowserStartedAt) / 1000)
      : 0
    return {
      uptime,
      totalGenerated: totalCertificatesGenerated,
      activePages: openPageCount,
      lastRestartTime: lastRestartTime ? new Date(lastRestartTime).toISOString() : null,
    }
  },
  async generateAndEmail(userId: string, courseId: string) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      include: { user: true, course: true },
    })
    if (!enrollment) {
      throw new Error("Enrollment not found for certificate generation.")
    }

    const certificateId =
      (await prisma.certificate
        .findUnique({ where: { enrollmentId: enrollment.id } })
        .then((record) => record?.uuid)) ?? randomUUID()

    const completionDate = enrollment.completedAt ?? new Date()
    const pdfBuffer = await renderCertificatePdf({
      recipientName: enrollment.user.name || "Jone Doe",
      courseTitle: enrollment.course.title,
      completionDate,
      certificateId,
    })

    await fs.mkdir(CERTIFICATE_DIR, { recursive: true })
    const fileName = `${certificateId}.pdf`
    const filePath = path.join(CERTIFICATE_DIR, fileName)
    const publicPath = `/certificates/${fileName}`
    await fs.writeFile(filePath, pdfBuffer)

    await upsertCertificateRecord({
      enrollmentId: enrollment.id,
      certificateId,
      issuedAt: completionDate,
      publicPath,
    })

    const appBaseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "")
    const certificateUrl = appBaseUrl ? `${appBaseUrl}${publicPath}` : publicPath
    await sendCertificateEmail({
      to: enrollment.user.email,
      name: enrollment.user.name || "Jone Doe",
      courseTitle: enrollment.course.title,
      certificateUrl,
      pdfBuffer,
    })
  },
  async sendSecurityAlertEmail(input: {
    to: string
    name: string
    eventType: string
    campaignName?: string | null
  }) {
    await sendSecurityAlertEmail(input)
  },
}
