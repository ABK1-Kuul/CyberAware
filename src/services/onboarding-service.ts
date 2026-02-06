import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { renderPdfFromHtml } from "@/services/certificate-service"

type WelcomeGuideInput = {
  name: string
  department: string
  email: string
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

function buildWelcomeGuideHtml(input: WelcomeGuideInput) {
  const safeName = input.name || "Teammate"
  const safeDepartment = input.department || "Your Team"

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Welcome Guide</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @page { size: A4; margin: 14mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <div class="min-h-screen flex items-center justify-center py-10">
      <div class="w-[210mm] min-h-[297mm] bg-white shadow-xl border border-slate-200 px-10 py-12">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Cyber Awareness</p>
            <h1 class="text-3xl font-semibold mt-2">Your Guide to Cyber Awareness</h1>
            <p class="text-sm text-slate-500 mt-1">Welcome, ${safeName}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400 uppercase tracking-[0.2em]">Department</p>
            <p class="text-sm font-medium text-slate-700">${safeDepartment}</p>
          </div>
        </div>

        <div class="mt-10 grid grid-cols-2 gap-6">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 class="text-sm uppercase tracking-[0.2em] text-slate-500">Secure Access</h2>
            <p class="mt-3 text-base font-medium text-slate-800">
              No passwords. Just secure, device-pinned access.
            </p>
            <p class="mt-2 text-sm text-slate-500">
              We use device-bound sessions and secure tokens to ensure your training stays private
              and protected.
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 class="text-sm uppercase tracking-[0.2em] text-slate-500">Your Mission</h2>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Spot suspicious emails quickly.</li>
              <li>• Report phishing attempts immediately.</li>
              <li>• Complete remediation lessons to keep risk low.</li>
            </ul>
          </div>
        </div>

        <div class="mt-10">
          <h2 class="text-sm uppercase tracking-[0.2em] text-slate-500">Earn Your Badges</h2>
          <div class="mt-4 grid grid-cols-2 gap-6">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-4">
              <div class="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" class="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2l4 4 5 1-3 4 1 5-7-3-7 3 1-5-3-4 5-1 4-4z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-800">Cyber Hero</p>
                <p class="text-xs text-slate-500">Report 3 simulations in a row with zero clicks.</p>
              </div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-4">
              <div class="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" class="h-6 w-6 text-sky-600" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2l7 3v6c0 5-3.8 9.6-7 11-3.2-1.4-7-6-7-11V5l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-800">First Responder</p>
                <p class="text-xs text-slate-500">Report a phish within the first 5 minutes.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-10 rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
          <h2 class="text-sm uppercase tracking-[0.2em] text-slate-300">Need Help?</h2>
          <p class="mt-2 text-sm text-slate-200">
            Your security team is here to support you. If you ever feel unsure about a message,
            report it right away.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`
}

async function sendWelcomeEmail({
  to,
  name,
  pdfBuffer,
}: {
  to: string
  name: string
  pdfBuffer: Buffer
}) {
  const config = getMailerConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Welcome to Cyber Awareness",
    text: `Hi ${name},\n\nWelcome aboard! Attached is your Cyber Awareness guide.\n\nStay safe.`,
    html: `<p>Hi ${name},</p><p>Welcome aboard! Attached is your Cyber Awareness guide.</p><p>Stay safe.</p>`,
    attachments: [
      {
        filename: "Cyber-Awareness-Welcome-Guide.pdf",
        content: pdfBuffer,
      },
    ],
  })
}

export async function generateWelcomeGuide(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      team: true,
      departmentId: true,
    },
  })
  if (!user) {
    throw new Error("User not found for welcome guide.")
  }
  const department = user.departmentId
    ? await prisma.department.findUnique({
        where: { id: user.departmentId },
        select: { name: true },
      })
    : null

  const html = buildWelcomeGuideHtml({
    name: user.name || "Teammate",
    department: department?.name ?? user.team ?? "Your Team",
    email: user.email,
  })
  const pdfBuffer = await renderPdfFromHtml(html, { format: "A4", landscape: false })

  try {
    await sendWelcomeEmail({
      to: user.email,
      name: user.name || "Teammate",
      pdfBuffer,
    })
  } catch (error) {
    logger.error("Welcome guide email failed", { error, userId })
  }

  return { buffer: pdfBuffer }
}

export const onboardingService = {
  generateWelcomeGuide,
}
