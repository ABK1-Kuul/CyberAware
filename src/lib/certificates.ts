import path from "path"
import fs from "fs/promises"
import { format } from "date-fns"
import nodemailer from "nodemailer"
import puppeteer from "puppeteer"

type CertificateInput = {
  recipientName: string
  courseTitle: string
  completionDate: Date
  certificateId: string
}

type CertificateResult = {
  filePath: string
  publicPath: string
}

const CERTIFICATE_DIR = path.join(process.cwd(), "public", "certificates")

function buildCertificateHtml(input: CertificateInput): string {
  const issueDate = format(input.completionDate, "MMMM d, yyyy")
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Certificate</title>
    <style>
      @page { size: 11in 8.5in; margin: 0; }
      body { margin: 0; font-family: "Georgia", "Times New Roman", serif; color: #0f172a; }
      .canvas {
        position: relative;
        width: 11in;
        height: 8.5in;
        background: #f8fafc;
        border: 20px solid #0f172a;
        box-sizing: border-box;
      }
      .title {
        position: absolute;
        top: 0.8in;
        width: 100%;
        text-align: center;
        font-size: 48px;
        letter-spacing: 4px;
        text-transform: uppercase;
      }
      .subtitle {
        position: absolute;
        top: 1.7in;
        width: 100%;
        text-align: center;
        font-size: 20px;
        color: #475569;
      }
      .name {
        position: absolute;
        top: 3.1in;
        width: 100%;
        text-align: center;
        font-size: 54px;
        font-weight: 700;
        color: #1d4ed8;
      }
      .course {
        position: absolute;
        top: 4.4in;
        width: 100%;
        text-align: center;
        font-size: 28px;
        font-weight: 600;
      }
      .date {
        position: absolute;
        bottom: 1.3in;
        left: 1.1in;
        font-size: 18px;
        border-top: 1px solid #475569;
        padding-top: 6px;
        width: 2.8in;
        text-align: center;
      }
      .signature {
        position: absolute;
        bottom: 1.3in;
        right: 1.1in;
        font-size: 18px;
        border-top: 1px solid #475569;
        padding-top: 6px;
        width: 2.8in;
        text-align: center;
      }
      .id {
        position: absolute;
        bottom: 0.5in;
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
      <div class="title">Certificate of Completion</div>
      <div class="subtitle">This certifies that</div>
      <div class="name">${input.recipientName}</div>
      <div class="subtitle" style="top: 3.9in;">has successfully completed</div>
      <div class="course">${input.courseTitle}</div>
      <div class="date">${issueDate}</div>
      <div class="signature">Authorized Signature</div>
      <div class="id">Certificate ID: ${input.certificateId}</div>
    </div>
  </body>
</html>`
}

export async function generateCertificate(input: CertificateInput): Promise<CertificateResult> {
  await fs.mkdir(CERTIFICATE_DIR, { recursive: true })
  const fileName = `${input.certificateId}.pdf`
  const filePath = path.join(CERTIFICATE_DIR, fileName)
  const publicPath = `/certificates/${fileName}`

  let browser: puppeteer.Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()
    page.setDefaultTimeout(30_000)
    await page.setContent(buildCertificateHtml(input), { waitUntil: "networkidle0" })
    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30_000,
    })
    await fs.writeFile(filePath, pdfBuffer)
    return { filePath, publicPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Certificate generation failed."
    if (message.toLowerCase().includes("browser disconnected")) {
      throw new Error("Certificate generation failed: browser disconnected.")
    }
    if (message.toLowerCase().includes("timeout")) {
      throw new Error("Certificate generation failed: PDF generation timeout.")
    }
    throw new Error(`Certificate generation failed: ${message}`)
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined)
    }
  }
}

type EmailInput = {
  to: string
  name: string
  courseTitle: string
  certificateUrl: string
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

export async function sendCertificateEmail(input: EmailInput): Promise<void> {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: `Your certificate for ${input.courseTitle}`,
    text: `Hi ${input.name},\n\nYour certificate is ready: ${input.certificateUrl}\n\nThank you.`,
    html: `<p>Hi ${input.name},</p><p>Your certificate is ready: <a href="${input.certificateUrl}">Download PDF</a></p><p>Thank you.</p>`,
  })
}
